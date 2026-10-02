"""Background mission runs (#44).

Start and approval requests return at once; the mission runs on a worker thread with
its own database session, and progress reaches the browser through the event stream.
This keeps every request short (no proxy/browser timeouts on slow Google calls or a
cold start), and a mission keeps going if the tab is closed.

One run per mission at a time: a decision that arrives while a run is in progress
marks the mission "again", and the worker runs it once more right after, so nothing is
lost and two runs never touch the same mission concurrently.
"""

import logging
import threading
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy.orm import Session, sessionmaker

from app.db.models import Mission, User
from app.domain import EventType, MissionStatus

log = logging.getLogger("agentos.worker")


class MissionWorker:
    def __init__(self, session_factory: sessionmaker[Session], google, max_workers: int = 4):
        self._session_factory = session_factory
        self._google = google
        self._pool = ThreadPoolExecutor(max_workers=max_workers, thread_name_prefix="mission")
        self._mu = threading.Lock()
        self._active: set[str] = set()
        self._again: set[str] = set()
        self._idle = threading.Condition(self._mu)

    def submit(self, mission_id: str, user_id: str) -> None:
        with self._mu:
            if mission_id in self._active:
                self._again.add(mission_id)
                return
            self._active.add(mission_id)
        self._pool.submit(self._run, mission_id, user_id)

    def wait_idle(self, timeout: float = 30.0) -> bool:
        """For tests and shutdown: wait until no mission is running."""
        with self._idle:
            return self._idle.wait_for(lambda: not self._active, timeout=timeout)

    def shutdown(self) -> None:
        self._pool.shutdown(wait=False, cancel_futures=True)

    def _run(self, mission_id: str, user_id: str) -> None:
        from app.services.runner import run_mission

        while True:
            with self._mu:
                self._again.discard(mission_id)
            try:
                with self._session_factory() as db:
                    user = db.get(User, user_id)
                    if user is not None:
                        run_mission(db, user, mission_id, self._google)
            except Exception:  # never leave a mission silently stuck in "running"
                log.exception("Background run failed for mission %s", mission_id)
                self._mark_failed(mission_id)
            with self._idle:
                if mission_id in self._again:
                    continue
                self._active.discard(mission_id)
                self._idle.notify_all()
                return

    def _mark_failed(self, mission_id: str) -> None:
        from app.services.missions import append_event

        try:
            with self._session_factory() as db:
                mission = db.get(Mission, mission_id)
                if mission is not None and mission.status == MissionStatus.RUNNING:
                    mission.status = MissionStatus.FAILED
                    append_event(db, mission, EventType.MISSION_FAILED, "planner",
                                 {"status": "failed", "summary": "An unexpected error stopped this mission. Start it again to continue."})
                    db.commit()
        except Exception:
            log.exception("Could not record the failure of mission %s", mission_id)
