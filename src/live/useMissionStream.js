import { useEffect, useRef, useState, useReducer, useCallback } from 'react';
import { LIVE_API_URL } from './config';
import { ops } from '../engine/ops';

export function formatEventText(e) {
  const p = e.payload || {};
  switch (e.type) {
    case 'MISSION_STARTED':
      return 'Mission execution started.';
    case 'AGENT_ASSIGNED':
      return `Agent ${e.agent || p.agent || 'execution'} assigned to step ${p.task_key || ''}`.trim();
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
      if (p.tool === 'web.search') {
        const n = p.output?.urls?.length || 0;
        const via = { wikipedia: 'Wikipedia', groq_search: 'Groq web search' }[p.output?.provider] || 'Google Search';
        return `Searched the web (${via}): ${n} source${n === 1 ? '' : 's'} found`;
      }
      if (p.tool === 'drive.create_document') {
        return `Created Google Doc: "${p.output?.title || 'Document'}"`;
      }
      if (p.tool === 'forms.create_form') {
        return `Created Google Form: "${p.output?.title || 'Form'}"`;
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
    case 'RECOVERY_STARTED':
      return `Recovery started: ${p.strategy || 'retrying step'}`;
    case 'PLAN_UPDATED':
      return `Mission plan updated: ${p.strategy || 'replacing step'}`;
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

export function mapEventType(type) {
  switch (type) {
    case 'MISSION_STARTED':
      return 'system';
    case 'AGENT_ASSIGNED':
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
    case 'PLAN_UPDATED':
      return 'plan';
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

export function applyMissionEvent(m, e) {
  if (!m) return m;
  const payload = e.payload || {};
  const uiEvent = backendEventToUi(e, m.createdAt);
  const taskKey = payload.task_key || payload.task_id || payload.taskId || null;

  let next = {
    ...m,
    events: [...(m.events || []), uiEvent].sort((a, b) => a.seq - b.seq),
    clock: uiEvent.t * 1000,
    updatedAt: uiEvent.at,
  };

  switch (e.type) {
    case 'MISSION_STARTED':
      next = ops.status('running')(next);
      break;

    case 'AGENT_ASSIGNED':
      if (taskKey) {
        next = ops.task(taskKey, { agent: e.agent || payload.agent })(next);
      }
      break;

    case 'TASK_STARTED':
      if (taskKey) {
        next = ops.task(taskKey, { status: 'running', startedAt: uiEvent.at })(next);
      }
      break;

    case 'TOOL_CALLED':
      if (taskKey) {
        next = ops.task(taskKey, { tool: payload.tool })(next);
      }
      break;

    case 'TOOL_COMPLETED':
      if (taskKey) {
        next = ops.task(taskKey, {
          status: 'done',
          finishedAt: uiEvent.at,
          output: payload.output,
          evidence: payload.evidence,
        })(next);
      }
      break;

    case 'APPROVAL_REQUESTED': {
      next = ops.status('awaiting_approval')(next);
      if (taskKey) {
        next = ops.task(taskKey, { status: 'awaiting' })(next);
      }
      const approvalId = payload.approval_id || `appr_${e.seq}`;
      const existing = (next.approvals || []).find((a) => a.id === approvalId);
      if (!existing) {
        const taskObj = next.tasks.find((t) => t.id === taskKey || t.key === taskKey);
        const newApproval = {
          id: approvalId,
          missionId: next.id,
          taskId: taskKey,
          title: taskObj?.title || 'Action confirmation',
          agent: 'approval',
          risk: (payload.risk || 'high').toLowerCase(),
          category: payload.category || 'External action',
          reason: payload.reason || 'Interacts with external application.',
          payload: payload.payload || {},
          original: payload.payload || {},
          status: 'pending',
          createdAt: uiEvent.at,
          isLive: true,
        };
        next = {
          ...next,
          approvals: [...(next.approvals || []), newApproval],
        };
      }
      break;
    }

    case 'APPROVAL_GRANTED': {
      const approvalId = payload.approval_id;
      if (approvalId && next.approvals) {
        next = {
          ...next,
          approvals: next.approvals.map((a) =>
            a.id === approvalId
              ? { ...a, status: payload.edited ? 'edited' : 'approved', resolvedAt: uiEvent.at }
              : a
          ),
        };
      }
      break;
    }

    case 'APPROVAL_REJECTED': {
      const approvalId = payload.approval_id;
      if (approvalId && next.approvals) {
        next = {
          ...next,
          approvals: next.approvals.map((a) =>
            a.id === approvalId
              ? { ...a, status: 'rejected', resolvedAt: uiEvent.at }
              : a
          ),
        };
      }
      if (taskKey) {
        next = ops.dropDep(taskKey)(next);
      }
      break;
    }

    case 'TASK_FAILED':
      if (taskKey) {
        next = ops.task(taskKey, {
          status: 'failed',
          finishedAt: uiEvent.at,
          error: payload.message || payload.error_class,
        })(next);
      }
      break;

    case 'RECOVERY_STARTED':
      next = ops.status('recovering')(next);
      next = ops.recovery({
        id: payload.recovery_id || taskKey || `rec_${e.seq}`,
        status: 'diagnosing',
        ...payload,
      })(next);
      break;

    case 'PLAN_UPDATED':
      if (payload.replaced_task_key && payload.replacement_task) {
        next = ops.replaceTask(payload.replaced_task_key, payload.replacement_task)(next);
      }
      break;

    case 'VERIFICATION_STARTED':
      break;

    case 'VERIFICATION_COMPLETED':
      if (Array.isArray(payload.criteria)) {
        for (const c of payload.criteria) {
          next = ops.check(c.label, c.passed ? 'done' : 'failed')(next);
        }
      }
      break;

    case 'MISSION_COMPLETED':
      next = ops.status('completed')(next);
      next.completedAt = uiEvent.at;
      break;

    case 'MISSION_FAILED':
      next = ops.status('failed')(next);
      next.completedAt = uiEvent.at;
      break;

    default:
      break;
  }

  // Auto update metric count: tasks done
  const doneCount = (next.tasks || []).filter((t) => t.status === 'done').length;
  next = ops.metricSet(doneCount)(next);

  return next;
}

export function missionEventReducer(mission, action) {
  if (!mission) {
    if (action.type === 'INIT') return action.mission;
    return mission;
  }

  switch (action.type) {
    case 'INIT':
      return action.mission;

    case 'EVENT': {
      const event = action.event;
      if (!event || typeof event.seq !== 'number') return mission;
      if ((mission.events || []).some((e) => e.seq === event.seq)) {
        return mission;
      }
      return applyMissionEvent(mission, event);
    }

    case 'EVENTS': {
      const events = Array.isArray(action.events) ? action.events : [];
      let next = mission;
      for (const e of events) {
        if (!e || typeof e.seq !== 'number') continue;
        if ((next.events || []).some((x) => x.seq === e.seq)) continue;
        next = applyMissionEvent(next, e);
      }
      return next;
    }

    default:
      return mission;
  }
}

export function useMissionStream(missionId, initialMission = null) {
  const [mission, dispatch] = useReducer(missionEventReducer, initialMission);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const lastSeqRef = useRef(0);
  const eventSourceRef = useRef(null);

  useEffect(() => {
    if (initialMission) {
      dispatch({ type: 'INIT', mission: initialMission });
      if (Array.isArray(initialMission.events) && initialMission.events.length > 0) {
        lastSeqRef.current = Math.max(lastSeqRef.current, ...initialMission.events.map((e) => e.seq || 0));
      }
    }
  }, [initialMission]);

  useEffect(() => {
    if (!LIVE_API_URL || !missionId) return;

    let stopped = false;
    let reconnectTimeout = null;

    function connect() {
      if (stopped) return;

      try {
        const streamUrl = `${LIVE_API_URL}/v1/missions/${encodeURIComponent(missionId)}/stream?after=${lastSeqRef.current}`;
        const es = new EventSource(streamUrl);
        eventSourceRef.current = es;

        es.onopen = () => {
          if (stopped) return;
          setConnected(true);
          setError(null);
        };

        const handleIncoming = (event) => {
          if (stopped) return;
          try {
            const parsed = JSON.parse(event.data);
            if (parsed && typeof parsed.seq === 'number') {
              lastSeqRef.current = Math.max(lastSeqRef.current, parsed.seq);
              dispatch({ type: 'EVENT', event: parsed });
            }
          } catch {
            // Heartbeats and empty comments are ignored
          }
        };

        const EVENT_TYPES = [
          'message',
          'MISSION_STARTED',
          'TASK_STARTED',
          'AGENT_ASSIGNED',
          'TOOL_CALLED',
          'TOOL_COMPLETED',
          'APPROVAL_REQUESTED',
          'APPROVAL_GRANTED',
          'APPROVAL_REJECTED',
          'TASK_FAILED',
          'RECOVERY_STARTED',
          'PLAN_UPDATED',
          'VERIFICATION_STARTED',
          'VERIFICATION_COMPLETED',
          'MISSION_COMPLETED',
          'MISSION_FAILED',
        ];

        for (const type of EVENT_TYPES) {
          es.addEventListener(type, handleIncoming);
        }

        es.onerror = () => {
          setConnected(false);
          if (es.readyState === EventSource.CLOSED) {
            setError(new Error('EventSource closed'));
            if (!stopped && !reconnectTimeout) {
              reconnectTimeout = setTimeout(() => {
                reconnectTimeout = null;
                connect();
              }, 1500);
            }
          }
        };
      } catch (err) {
        setConnected(false);
        setError(err);
      }
    }

    connect();

    return () => {
      stopped = true;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [missionId]);

  return {
    mission,
    dispatch,
    connected,
    error,
    lastSeq: lastSeqRef.current,
  };
}
