import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  advance,
  createMission,
  resolveApproval,
  restartMission,
  runInstantly,
  setSpeed as setMissionSpeed,
  togglePause as toggleMissionPause,
} from '../engine/engine';
import { DEMO_GOAL } from '../data/templates';
import { clearMissions, loadMissions, saveMissions } from './persistence';
import { usePreferences } from './PreferencesStore';

const MissionContext = createContext(null);

const MIN = 60_000;

const normalise = (goal) => goal.trim().toLowerCase().replace(/[.!\s]+$/, '').replace(/\s+/g, ' ');

// Example history so the console never opens empty. The hero demo mission is
// deliberately not seeded: it should be launched live.
export function seedMissions() {
  const now = Date.now();
  return [
    runInstantly('Invoice all clients for September and chase overdue payments', {
      createdAt: now - 12 * MIN,
      stopAtApproval: true,
    }),
    runInstantly('Find 5 AI internship openings and apply to the best 3', { createdAt: now - 3 * 60 * MIN }),
    runInstantly('Get 3 quotes for 20 office monitors under $250 each', { createdAt: now - 26 * 60 * MIN }),
  ];
}

export function MissionProvider({ children }) {
  const { preferences } = usePreferences();
  // Saved demo state from this browser if it is valid, otherwise a fresh start.
  const [missions, setMissions] = useState(() => loadMissions() ?? seedMissions());
  const [launcher, setLauncher] = useState({ open: false, goal: '' });
  // Latest missions for event handlers, so a double click can't act on stale state.
  const latest = useRef(missions);
  latest.current = missions;

  useEffect(() => {
    saveMissions(missions);
  }, [missions]);

  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now();
      setMissions((ms) => {
        let changed = false;
        const next = ms.map((m) => {
          const n = advance(m, now);
          if (n !== m) changed = true;
          return n;
        });
        return changed ? next : ms;
      });
    }, 120);
    return () => clearInterval(id);
  }, []);

  const value = useMemo(() => {
    const update = (id, fn) => setMissions((ms) => ms.map((m) => (m.id === id ? fn(m, Date.now()) : m)));

    // "Try Demo Mission": there is only ever one demo run. If it is in
    // progress, go back to it; if it finished, start it over.
    const startDemo = () => {
      setLauncher({ open: false, goal: '' });
      const existing = latest.current.find((m) => m.demo);
      if (existing && existing.status !== 'completed') return existing.id;
      if (existing) {
        const restarted = restartMission(existing, Date.now());
        latest.current = latest.current.map((m) => (m.id === existing.id ? restarted : m));
        setMissions((ms) => ms.map((m) => (m.id === existing.id ? restarted : m)));
        return existing.id;
      }
      const m = createMission(DEMO_GOAL, { demo: true, preferences });
      latest.current = [m, ...latest.current];
      setMissions((ms) => [m, ...ms]);
      return m.id;
    };

    return {
      missions,
      launcher,
      startDemo,
      launch(goal, opts) {
        // Typing the demo goal runs the demo mission rather than a duplicate of it.
        if (normalise(goal) === normalise(DEMO_GOAL)) return startDemo();
        const m = createMission(goal.trim(), { ...opts, preferences });
        setMissions((ms) => [m, ...ms]);
        setLauncher({ open: false, goal: '' });
        return m.id;
      },
      decide(missionId, approvalId, decision, edits) {
        update(missionId, (m, now) => resolveApproval(m, approvalId, decision, edits, now));
      },
      // Wipes saved demo data and returns to the initial example missions.
      resetDemo() {
        clearMissions();
        const seeds = seedMissions();
        latest.current = seeds;
        setMissions(seeds);
        setLauncher({ open: false, goal: '' });
      },
      restart(missionId) {
        update(missionId, (m, now) => restartMission(m, now));
      },
      setSpeed(missionId, speed) {
        update(missionId, (m, now) => setMissionSpeed(m, speed, now));
      },
      togglePause(missionId) {
        update(missionId, (m, now) => toggleMissionPause(m, now));
      },
      openLauncher(goal = '') {
        setLauncher({ open: true, goal });
      },
      closeLauncher() {
        setLauncher({ open: false, goal: '' });
      },
    };
  }, [missions, launcher, preferences]);

  return <MissionContext.Provider value={value}>{children}</MissionContext.Provider>;
}

export function useMissions() {
  const ctx = useContext(MissionContext);
  if (!ctx) throw new Error('useMissions must be used inside <MissionProvider>');
  return ctx;
}

export function useMission(id) {
  const { missions } = useMissions();
  return missions.find((m) => m.id === id) || null;
}

export function usePendingApprovals() {
  const { missions } = useMissions();
  return missions.flatMap((m) => m.approvals.filter((a) => a.status === 'pending'));
}
