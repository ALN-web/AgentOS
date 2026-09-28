import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  advance,
  createMission,
  resolveApproval,
  runInstantly,
  setSpeed as setMissionSpeed,
  togglePause as toggleMissionPause,
} from '../engine/engine';

const MissionContext = createContext(null);

const MIN = 60_000;

// Example history so the console never opens empty. The hero demo mission is
// deliberately not seeded: it should be launched live.
function seedMissions() {
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
  const [missions, setMissions] = useState(seedMissions);
  const [launcher, setLauncher] = useState({ open: false, goal: '' });

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
    return {
      missions,
      launcher,
      launch(goal, opts) {
        const m = createMission(goal.trim(), opts);
        setMissions((ms) => [m, ...ms]);
        setLauncher({ open: false, goal: '' });
        return m.id;
      },
      decide(missionId, approvalId, decision, edits) {
        update(missionId, (m, now) => resolveApproval(m, approvalId, decision, edits, now));
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
  }, [missions, launcher]);

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
