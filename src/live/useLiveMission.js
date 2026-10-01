import { useEffect, useState, useRef, useCallback } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';
import {
  useMissionStream,
  formatEventText,
  mapEventType,
  backendEventToUi,
  applyMissionEvent,
  missionEventReducer,
} from './useMissionStream';

export {
  useMissionStream,
  formatEventText,
  mapEventType,
  backendEventToUi,
  applyMissionEvent,
  missionEventReducer,
};

export function useLiveMission(missionId) {
  const [initialMission, setInitialMission] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(Boolean(LIVE_API_URL && missionId));
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);

  // Initial load of mission detail, initial backlog events, and evidence
  useEffect(() => {
    if (!LIVE_API_URL || !missionId) {
      setLoading(false);
      return;
    }

    let active = true;

    async function load() {
      try {
        setLoading(true);
        const [mDetail, initialEvents, initialEvidence] = await Promise.all([
          api.getMission(missionId).catch(() => null),
          api.listEvents(missionId, 0).catch(() => []),
          api.getMissionEvidence(missionId).catch(() => []),
        ]);

        if (!active || !mDetail) {
          setLoading(false);
          return;
        }

        setEvidence(initialEvidence || []);

        const initialTasks = (mDetail.tasks || []).map((t) => ({
          id: t.key || t.id,
          key: t.key || t.id,
          title: t.title,
          agent: t.agent,
          deps: t.dependencies || t.deps || [],
          gated: t.gated,
          type: t.type,
          capability: t.capability,
          criterion: t.criterion,
          inputs: t.inputs || {},
          status:
            t.status === 'done'
              ? 'done'
              : t.status === 'running'
              ? 'running'
              : t.status === 'awaiting'
              ? 'awaiting'
              : t.status === 'failed'
              ? 'failed'
              : 'pending',
          output: t.output,
          startedAt: t.started_at ? new Date(t.started_at).getTime() : null,
          finishedAt: t.finished_at ? new Date(t.finished_at).getTime() : null,
        }));

        let baseMission = {
          id: mDetail.id,
          goal: mDetail.goal,
          status: mDetail.status || 'running',
          isLive: true,
          demo: false,
          speed: 1,
          paused: false,
          createdAt: mDetail.created_at ? new Date(mDetail.created_at).getTime() : Date.now(),
          clock: 0,
          plan: mDetail.plan || { tasks: initialTasks, criteria: [] },
          tasks: initialTasks,
          events: [],
          approvals: (mDetail.approvals || []).map((a) => ({
            id: a.id,
            missionId: mDetail.id,
            taskId: a.task_id,
            title: a.title || 'Action confirmation',
            agent: 'approval',
            risk: (a.risk || 'high').toLowerCase(),
            category: a.category || 'External action',
            reason: a.reason,
            payload: a.payload || {},
            original: a.payload || {},
            status: a.status || 'pending',
            createdAt: a.requested_at ? new Date(a.requested_at).getTime() : Date.now(),
            resolvedAt: a.decided_at ? new Date(a.decided_at).getTime() : null,
            isLive: true,
          })),
          recoveries: [],
          checks: [],
          metric: mDetail.plan?.metric
            ? { ...mDetail.plan.metric, current: initialTasks.filter((t) => t.status === 'done').length }
            : {
                kind: 'criteria',
                label: 'tasks done',
                target: initialTasks.length,
                current: initialTasks.filter((t) => t.status === 'done').length,
              },
          browser: null,
        };

        if (Array.isArray(initialEvents) && initialEvents.length > 0) {
          for (const ev of initialEvents) {
            baseMission = applyMissionEvent(baseMission, ev);
          }
        }

        setInitialMission(baseMission);
      } catch (err) {
        if (active) setError(err.message || 'Failed to load mission.');
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, [missionId]);

  const { mission, connected } = useMissionStream(missionId, initialMission);

  const decideApproval = useCallback(
    async (approvalId, decision, edits = null) => {
      setApproving(true);
      setError(null);
      try {
        const updated = await api.decideApproval(approvalId, decision, edits);
        const newEvidence = await api.getMissionEvidence(missionId).catch(() => []);
        setEvidence(newEvidence || []);
        return updated;
      } catch (err) {
        setError(err.message || 'Failed to submit approval decision.');
        throw err;
      } finally {
        setApproving(false);
      }
    },
    [missionId]
  );

  return {
    mission,
    evidence,
    loading,
    error,
    approving,
    connected,
    decideApproval,
  };
}
