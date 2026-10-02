"""User preferences: storage, and applying them to tool arguments (#18).

Preferences are applied to a tool's arguments *before* the approval step, so
what the user approves is exactly what will run. Rules:
- Calendar: no explicit time in the goal -> the next slot inside working days
  and hours, in the user's timezone, lasting the default meeting length.
  An explicit time is kept (the goal wins) and only gains the timezone.
- Email drafts: the signature is appended once; the sender name and tone are
  passed along for drafting.
- Recipients: a group name ("my team") expands to the stored emails. An unknown
  group is never guessed: it raises UnknownGroupError so the user is asked.
Preferences stay per user and are never logged.
"""

from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.db.models import User, UserPreference
from app.schemas.preferences import DAYS, Preferences

CALENDAR_CREATE_TOOLS = {"calendar.create_event"}
DRAFT_TOOLS = {"gmail.create_draft"}
GROUP_KEYS = ("to_group", "attendees_group")


class UnknownGroupError(Exception):
    def __init__(self, group: str):
        super().__init__(group)
        self.group = group
        self.question = f"Who is '{group}'? Add them as a contact group in Settings, or name the recipients."


def load_preferences(db: Session, user: User) -> Preferences:
    row = db.get(UserPreference, user.id)
    if row is None:
        return Preferences()
    raw_groups = row.groups or []
    clean_groups = []
    onboarding_dismissed = False
    for g in raw_groups:
        if isinstance(g, dict) and g.get("__meta__"):
            onboarding_dismissed = bool(g.get("onboarding_dismissed", False))
        else:
            clean_groups.append(g)

    return Preferences(
        timezone=row.timezone,
        working_days=row.working_days or list(DAYS[:5]),
        working_hours={"start": row.work_start, "end": row.work_end},
        display_name=row.display_name,
        signature=row.signature,
        tone=row.tone,
        meeting_length=row.meeting_length,
        groups=clean_groups,
        onboarding_dismissed=onboarding_dismissed,
    )


def save_preferences(db: Session, user: User, prefs: Preferences) -> Preferences:
    row = db.get(UserPreference, user.id) or UserPreference(user_id=user.id)
    row.timezone = prefs.timezone
    row.working_days = list(prefs.working_days)
    row.work_start = prefs.working_hours.start
    row.work_end = prefs.working_hours.end
    row.display_name = prefs.display_name
    row.signature = prefs.signature
    row.tone = prefs.tone
    row.meeting_length = prefs.meeting_length
    serialized_groups = [g.model_dump() for g in prefs.groups]
    if prefs.onboarding_dismissed:
        serialized_groups.append({"__meta__": True, "onboarding_dismissed": True})
    row.groups = serialized_groups
    db.add(row)
    db.commit()
    return load_preferences(db, user)


def next_free_slot(prefs: Preferences, now: datetime) -> tuple[datetime, datetime]:
    """The next start at or after `now` (rounded up to :00/:30) that fits a meeting of the
    default length inside working hours on a working day, in the user's timezone."""
    tz = ZoneInfo(prefs.timezone)
    length = timedelta(minutes=prefs.meeting_length)
    start_h, start_m = map(int, prefs.working_hours.start.split(":"))
    end_h, end_m = map(int, prefs.working_hours.end.split(":"))
    local = now.astimezone(tz)
    rounded = local.replace(second=0, microsecond=0)
    if rounded.minute not in (0, 30) or rounded < local:
        rounded += timedelta(minutes=(30 - rounded.minute % 30) % 30 or 30)
    candidate = rounded
    for _ in range(15):  # two weeks is enough to find a working day
        day_start = candidate.replace(hour=start_h, minute=start_m)
        day_end = candidate.replace(hour=end_h, minute=end_m)
        if DAYS[candidate.weekday()] in prefs.working_days:
            begin = max(candidate, day_start)
            if begin + length <= day_end:
                return begin, begin + length
        candidate = (candidate + timedelta(days=1)).replace(hour=start_h, minute=start_m)
    raise ValueError("no working slot found within two weeks")


def resolve_group(prefs: Preferences, name: str) -> list[str]:
    wanted = " ".join(str(name).split()).lower()
    for g in prefs.groups:
        if g.name.lower() == wanted:
            return list(g.emails)
    raise UnknownGroupError(" ".join(str(name).split()))


def apply_preferences(tool_name: str, args: dict[str, Any], prefs: Preferences, now: datetime | None = None) -> tuple[dict[str, Any], list[str]]:
    """Return (new_args, applied_preference_names). `args` is not modified."""
    now = now or datetime.now(dt_timezone.utc)
    out = dict(args)
    applied: list[str] = []

    for key in GROUP_KEYS:
        if out.get(key):
            emails = resolve_group(prefs, out.pop(key))
            target = "to" if key == "to_group" else "attendees"
            out[target] = ", ".join(emails) if target == "to" else emails
            applied.append("contact_groups")

    if tool_name in CALENDAR_CREATE_TOOLS:
        if not out.get("timezone"):
            out["timezone"] = prefs.timezone
            applied.append("timezone")
        if not out.get("start"):
            start, end = next_free_slot(prefs, now)
            out["start"], out["end"] = start.isoformat(), end.isoformat()
            applied += ["working_hours", "working_days", "meeting_length"]
        elif not out.get("end"):
            start = datetime.fromisoformat(str(out["start"]))
            out["end"] = (start + timedelta(minutes=prefs.meeting_length)).isoformat()
            applied.append("meeting_length")

    if tool_name in DRAFT_TOOLS:
        if prefs.signature:
            if out.get("body"):
                if prefs.signature not in out["body"]:
                    out["body"] = f"{out['body'].rstrip()}\n\n{prefs.signature}"
            else:
                out["signature"] = prefs.signature
            applied.append("signature")
        if prefs.display_name:
            out.setdefault("sender_name", prefs.display_name)
            applied.append("display_name")
        out.setdefault("tone", prefs.tone)
        applied.append("tone")

    return out, list(dict.fromkeys(applied))
