import { useEffect, useState, useRef, useCallback } from 'react';
import { LIVE_API_URL } from './config';
import { api } from './api';

function formatEventText(e) {
  const p = e.payload || {};
  switch (e.type) {
    case 'MISSION_STARTED':
      return 'Mission execution started.';
    case 'TASK_STARTED':
      return p.title ? `Started: ${p.title}` : `Started step ${p.task_key || ''}`.trim();
    case 'TOOL_CALLED':
      return `Executing tool: ${p.tool || 'system action'}`;
    case 'TOOL_COMPLETED': {
      if (p.tool === 'calendar.create_event') {
        return `Created Google Calendar event: ${p.output?.summary || 'Event scheduled'}`;
      }
      if (p.tool === 'calendar.list_events') {
        return `Checked Google Calendar availability: found open slot`;
      }
      if (p.tool === 'gmail.create_draft') {
        return `Drafted invitation in Gmail: "${p.output?.subject || 'Dinner invitation'}"`;
      }
      if (p.tool === 'gmail.send_draft') {
        return `Dispatched emails via Gmail to ${p.output?.to || 'attendees'}`;
      }
      return `Completed ${p.tool || 'action'} successfully`;
    }
    case 'APPROVAL_REQUESTED':
      return `Approval required: ${p.reason || 'External action'}`;
    case 'APPROVAL_GRANTED':
      return `Approval granted ${p.edited ? 'with edits' : ''}. Resuming execution.`.trim();
    case 'APPROVAL_REJECTED':
      return 'Approval rejected. Action skipped.';
    case 'TASK_FAILED':
      return `Step failed: ${p.message || p.error_class || 'execution error'}`;
    case 'VERIFICATION_STARTED':
      return 'Verifying outcome across external tools and calendar.';
    case 'VERIFICATION_COMPLETED':
      return p.verified ? 'All verification criteria confirmed passed.' : 'Verification encountered failures.';
    case 'MISSION_COMPLETED':
      return 'Mission accomplished and verified in real accounts.';
    case 'MISSION_FAILED':
      return 'Mission stopped due to execution failure.';
    default:
      return p.message || e.type;
  }
}

function mapEventType(type) {
  switch (type) {
    case 'MISSION_STARTED':
      return 'system';
    case 'TASK_STARTED':
      return 'plan';
    case 'TOOL_CALLED':
    case 'TOOL_COMPLETED':
    case 'APPROVAL_GRANTED':
      return 'action';
    case 'APPROVAL_REQUESTED':
      return 'approval';
    case 'APPROVAL_REJECTED':
    case 'TASK_FAILED':
    case 'MISSION_FAILED':
      return 'failure';
    case 'RECOVERY_STARTED':
      return 'recovery';
    case 'VERIFICATION_STARTED':
      return 'critique';
    case 'VERIFICATION_COMPLETED':
      return 'verified';
    case 'MISSION_COMPLETED':
      return 'complete';
    default:
      return 'system';
  }
}

export function backendEventToUi(e, startTimeMs = Date.now()) {
  const at = e.created_at ? new Date(e.created_at).getTime() : Date.now();
  const t = Math.max(0, Math.floor((at - startTimeMs) / 1000));
  const payload = e.payload || {};
  return {
    id: `evt_${e.seq}`,
    seq: e.seq,
    type: mapEventType(e.type),
    rawType: e.type,
    agent: e.agent || 'execution',
    text: formatEventText(e),
    at,
    t,
    taskId: payload.task_key || payload.task_id || null,
    evidence: Array.isArray(payload.evidence) ? payload.evidence : [],
    payload,
  };
}

export function useLiveMission(missionId) {
  const [mission, setMission] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [loading, setLoading] = useState(Boolean(LIVE_API_URL && missionId));
  const [error, setError] = useState(null);
  const [approving, setApproving] = useState(false);
  const lastSeqRef = useRef(0);
  const startTimeRef = useRef(Date.now());

  const processEvents = useCallback((rawEvents, baseMission = null) => {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) return;

    setMission((prev) => {
      const cur = prev || baseMission;
      if (!cur) return prev;

      const newEvents = rawEvents.map((e) => backendEventToUi(e, startTimeRef.current));
      const existingSeqs = new Set(cur.events.map((e) => e.seq));
      const filteredNew = newEvents.filter((e) => !existingSeqs.has(e.seq));

      if (filteredNew.length === 0) return cur;

      const combinedEvents = [...cur.events, ...filteredNew].sort((a, b) => a.seq - b.seq);
      lastSeqRef.current = Math.max(lastSeqRef.current, ...combinedEvents.map((e) => e.seq));

      // Update tasks and approvals based on incoming events
      const nextTasks = cur.tasks.map((t) => ({ ...t }));
      const nextApprovals = [...cur.approvals];
      let nextStatus = cur.status;
      let checks = [...cur.checks];

      for (const e of filteredNew) {
        const p = e.payload || {};
        if (e.rawType === 'MISSION_STARTED') nextStatus = 'running';
        if (e.rawType === 'MISSION_COMPLETED') nextStatus = 'completed';
        if (e.rawType === 'MISSION_FAILED') nextStatus = 'failed';

        if (e.rawType === 'TASK_STARTED' && p.task_key) {
          const t = nextTasks.find((x) => x.id === p.task_key || x.key === p.task_key);
          if (t) {
            t.status = 'running';
            t.startedAt = e.at;
          }
        }

        if (e.rawType === 'TOOL_COMPLETED' && p.task_key) {
          const t = nextTasks.find((x) => x.id === p.task_key || x.key === p.task_key);
          if (t) {
            t.status = 'done';
            t.finishedAt = e.at;
            t.output = p.output;
            t.evidence = p.evidence;
          }
        }

        if (e.rawType === 'TASK_FAILED' && p.task_key) {
          const t = nextTasks.find((x) => x.id === p.task_key || x.key === p.task_key);
          if (t) {
            t.status = 'failed';
            t.finishedAt = e.at;
            t.error = p.message;
          }
        }

        if (e.rawType === 'APPROVAL_REQUESTED' && p.approval_id) {
          nextStatus = 'awaiting_approval';
          const existingAppr = nextApprovals.find((a) => a.id === p.approval_id);
          const taskObj = nextTasks.find((x) => x.id === p.task_key || x.key === p.task_key);
          if (!existingAppr) {
            nextApprovals.push({
              id: p.approval_id,
              missionId: cur.id,
              taskId: p.task_key,
              title: taskObj?.title || 'Action confirmation',
              agent: 'approval',
              risk: (p.risk || 'high').toLowerCase(),
              category: p.category || 'External action',
              reason: p.reason || 'Interacts with external application.',
              payload: p.payload || {},
              original: p.payload || {},
              status: 'pending',
              createdAt: e.at,
              isLive: true,
            });
          }
          if (taskObj) taskObj.status = 'awaiting';
        }

        if (e.rawType === 'APPROVAL_GRANTED' && p.approval_id) {
          const appr = nextApprovals.find((a) => a.id === p.approval_id);
          if (appr) {
            appr.status = p.edited ? 'edited' : 'approved';
            appr.resolvedAt = e.at;
          }
        }

        if (e.rawType === 'APPROVAL_REJECTED' && p.approval_id) {
          const appr = nextApprovals.find((a) => a.id === p.approval_id);
          if (appr) {
            appr.status = 'rejected';
            appr.resolvedAt = e.at;
          }
        }

        if (e.rawType === 'VERIFICATION_COMPLETED' && Array.isArray(p.criteria)) {
          checks = p.criteria.map((c) => ({
            label: c.label,
            status: c.passed ? 'done' : 'failed',
          }));
        }
      }

      // Compute current metric
      const doneCount = nextTasks.filter((t) => t.status === 'done').length;
      const nextMetric = {
        ...(cur.metric || { kind: 'criteria', label: 'tasks done', target: nextTasks.length }),
        current: doneCount,
      };

      return {
        ...cur,
        status: nextStatus,
        tasks: nextTasks,
        approvals: nextApprovals,
        events: combinedEvents,
        checks,
        metric: nextMetric,
      };
    });
  }, []);

  // Initial load
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

        startTimeRef.current = mDetail.started_at ? new Date(mDetail.started_at).getTime() : Date.now();
        setEvidence(initialEvidence || []);

        const initialTasks = (mDetail.tasks || []).map((t) => ({
          id: t.id,
          key: t.key,
          title: t.title,
          agent: t.agent,
          deps: t.dependencies || [],
          gated: t.gated,
          type: t.type,
          capability: t.capability,
          criterion: t.criterion,
          inputs: t.inputs || {},
          status: t.status === 'done' ? 'done' : t.status === 'running' ? 'running' : t.status === 'awaiting' ? 'awaiting' : t.status === 'failed' ? 'failed' : 'pending',
          output: t.output,
          startedAt: t.started_at ? new Date(t.started_at).getTime() : null,
          finishedAt: t.finished_at ? new Date(t.finished_at).getTime() : null,
        }));

        const uiMission = {
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
            : { kind: 'criteria', label: 'tasks done', target: initialTasks.length, current: initialTasks.filter((t) => t.status === 'done').length },
          browser: null,
        };

        setMission(uiMission);

        if (Array.isArray(initialEvents) && initialEvents.length > 0) {
          processEvents(initialEvents, uiMission);
        }
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
  }, [missionId, processEvents]);

  // Real-time Event Streaming (SSE with polling fallback)
  useEffect(() => {
    if (!LIVE_API_URL || !missionId || !mission) return;
    if (mission.status === 'completed' || mission.status === 'failed') return;

    let stopped = false;
    let eventSource = null;
    let pollInterval = null;

    // Connect to SSE stream
    try {
      const streamUrl = `${LIVE_API_URL}/missions/${encodeURIComponent(missionId)}/stream?after=${lastSeqRef.current}`;
      eventSource = new EventSource(streamUrl);

      eventSource.onmessage = (event) => {
        if (stopped) return;
        try {
          const parsed = JSON.parse(event.data);
          processEvents([parsed]);
        } catch {
          // ignore parse errors
        }
      };

      eventSource.onerror = () => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        // Fallback to polling if SSE encounters an error
        if (!stopped && !pollInterval) {
          pollInterval = setInterval(async () => {
            if (stopped) return;
            try {
              const evs = await api.listEvents(missionId, lastSeqRef.current);
              if (Array.isArray(evs) && evs.length > 0) {
                processEvents(evs);
              }
            } catch {
              // ignore polling error
            }
          }, 1500);
        }
      };
    } catch {
      // If EventSource is unsupported or throws, fallback to polling
      pollInterval = setInterval(async () => {
        if (stopped) return;
        try {
          const evs = await api.listEvents(missionId, lastSeqRef.current);
          if (Array.isArray(evs) && evs.length > 0) {
            processEvents(evs);
          }
        } catch {
          // ignore
        }
      }, 1500);
    }

    return () => {
      stopped = true;
      if (eventSource) eventSource.close();
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [missionId, mission?.status, processEvents]);

  const decideApproval = useCallback(
    async (approvalId, decision, edits = null) => {
      setApproving(true);
      setError(null);
      try {
        const updated = await api.decideApproval(approvalId, decision, edits);
        // Refresh evidence & events
        const [evs, newEvidence] = await Promise.all([
          api.listEvents(missionId, lastSeqRef.current).catch(() => []),
          api.getMissionEvidence(missionId).catch(() => []),
        ]);
        if (Array.isArray(evs) && evs.length > 0) {
          processEvents(evs);
        }
        setEvidence(newEvidence || []);
        return updated;
      } catch (err) {
        setError(err.message || 'Failed to submit approval decision.');
        throw err;
      } finally {
        setApproving(false);
      }
    },
    [missionId, processEvents]
  );

  return {
    mission,
    evidence,
    loading,
    error,
    approving,
    decideApproval,
  };
}
