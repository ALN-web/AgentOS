import React, { useMemo } from 'react';
import { Background, Handle, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Clock, GitMerge, Loader2, Lock, ShieldAlert, SkipForward, Target, Timer, X } from 'lucide-react';
import { AgentIcon, agentName, formatDuration } from '../../components/ui';
import { AppBadge, appForTask, getAppMeta } from '../../components/AppIcon';
import { taskDuration } from '../../engine/selectors';

const NODE_W = 210;
const COL_GAP = 270;
const ROW_GAP = 112;

export function getDataFlowLabel(src, target) {
  if (!src || !target) return null;

  // 1. Direct inputs mapping from blueprint / compiler
  if (target.inputs && typeof target.inputs === 'object') {
    for (const [key, ref] of Object.entries(target.inputs)) {
      if (typeof ref === 'string') {
        const matchesSrc =
          ref.startsWith(src.id) ||
          (src.blueprintStepId && ref.startsWith(src.blueprintStepId)) ||
          ref.includes(src.id);
        if (matchesSrc) {
          return humanizeDataKey(key);
        }
      }
    }
  }

  // 2. Cross-app specific flow labels
  const sApp = src.app || appForTask(src);
  const tApp = target.app || appForTask(target);

  if (sApp === 'google-calendar' && tApp === 'gmail') {
    return 'event link';
  }
  if (sApp === 'google-calendar' && tApp === 'google-calendar') {
    if (src.title?.toLowerCase().includes('slot') || src.title?.toLowerCase().includes('time')) {
      return 'time slot';
    }
    if (target.title?.toLowerCase().includes('reminder')) {
      return 'event ID';
    }
  }
  if (sApp === 'google-drive' && tApp === 'google-calendar') {
    return 'plan details';
  }
  if (sApp === 'google-calendar' && tApp === 'google-drive') {
    return 'schedule';
  }
  if (sApp === 'gmail' && tApp === 'google-calendar') {
    return 'availability';
  }

  // 3. Meaningful domain flow labels for demo / marketing / personal
  const sTitle = (src.title || '').toLowerCase();
  const tTitle = (target.title || '').toLowerCase();
  if (sTitle.includes('time') && (tTitle.includes('event') || tTitle.includes('calendar'))) {
    return 'time slot';
  }
  if ((sTitle.includes('event') || sTitle.includes('calendar')) && (tTitle.includes('invite') || tTitle.includes('invitation'))) {
    return 'event link';
  }
  if (tTitle.includes('reminder') && (sTitle.includes('event') || sTitle.includes('calendar'))) {
    return 'event ID';
  }

  return null;
}

function humanizeDataKey(k) {
  const map = {
    event_link: 'event link',
    time_slot: 'time slot',
    event_id: 'event ID',
    draft_id: 'draft',
    start: 'time slot',
    free_slots: 'free blocks',
    attendees: 'guest list',
    attendee_list: 'guest list',
    draft_plan: 'draft plan',
    focus_blocks: 'focus blocks',
    summary: 'summary',
    schedule: 'schedule',
    document_id: 'document',
    doc_link: 'doc link',
  };
  return map[k] || k.replace(/_/g, ' ');
}

const STATUS_STYLE = {
  pending: { label: 'Queued', box: 'border-white/10 bg-[#0f0d15]', icon: Clock, iconCls: 'text-gray-500', chip: 'text-gray-400 bg-white/[0.04] border-white/10' },
  running: {
    label: 'In progress',
    box: 'border-[#eb6920] bg-[#1a120d] shadow-[0_0_24px_rgba(235,105,32,0.35)]',
    icon: Loader2,
    iconCls: 'text-[#eb6920] animate-spin',
    chip: 'text-[#ff9a5c] bg-[#eb6920]/10 border-[#eb6920]/30',
  },
  awaiting: {
    label: 'Needs approval',
    box: 'border-amber-400 bg-[#1a160b] shadow-[0_0_24px_rgba(251,191,36,0.25)]',
    icon: ShieldAlert,
    iconCls: 'text-amber-300',
    chip: 'text-amber-300 bg-amber-400/10 border-amber-400/30',
  },
  done: { label: 'Done', box: 'border-emerald-400/40 bg-[#0c1410]', icon: Check, iconCls: 'text-emerald-400', chip: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/25' },
  failed: {
    label: 'Failed',
    box: 'border-red-500 bg-[#1a0d0d] shadow-[0_0_24px_rgba(239,68,68,0.35)]',
    icon: X,
    iconCls: 'text-red-400',
    chip: 'text-red-300 bg-red-400/10 border-red-400/30',
  },
  skipped: { label: 'Skipped', box: 'border-white/5 bg-[#0c0b10] opacity-40', icon: SkipForward, iconCls: 'text-gray-500', chip: 'text-gray-500 bg-white/[0.03] border-white/5' },
};

function TaskNode({ data }) {
  const { task, duration, clickable } = data;
  const style = STATUS_STYLE[task.status] || STATUS_STYLE.pending;
  const Icon = style.icon;
  const current = task.status === 'running' || task.status === 'awaiting';
  const gate = task.gated && task.status === 'pending';
  const appMeta = getAppMeta(appForTask(task));

  return (
    <div
      className={`relative rounded-2xl border px-3 py-2.5 transition-all duration-500 ${style.box} ${gate ? '!border-dashed !border-amber-400/50' : ''} ${
        clickable ? 'cursor-pointer hover:brightness-125' : ''
      }`}
      style={{ width: NODE_W }}
    >
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      {current && (
        <span className="absolute -top-2 right-3 px-1.5 py-px rounded-md bg-[#eb6920] text-[8px] font-extrabold uppercase tracking-wider text-white shadow-[0_0_10px_rgba(235,105,32,0.6)]">
          Now
        </span>
      )}
      <div className="flex items-center gap-2.5">
        <AgentIcon id={task.agent} size="sm" />
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] leading-tight font-semibold text-white line-clamp-2 ${task.status === 'skipped' ? 'line-through' : ''}`}>{task.title}</div>
          <div className="text-[10px] text-gray-500 truncate flex items-center gap-1 mt-0.5">
            <span>{agentName(task.agent)}</span>
            {appMeta && (
              <>
                <span className="text-gray-600">·</span>
                <span className={`inline-flex items-center gap-0.5 font-medium ${appMeta.text}`}>
                  <appMeta.icon className="w-2.5 h-2.5 shrink-0" />
                  {appMeta.shortName}
                </span>
              </>
            )}
          </div>
        </div>
        <Icon className={`w-3.5 h-3.5 shrink-0 ${style.iconCls}`} />
      </div>
      <div className="mt-2 flex items-center gap-1.5 text-[9px] font-semibold flex-wrap">
        <span className={`px-1.5 py-0.5 rounded-md border ${gate ? 'text-amber-300 bg-amber-400/10 border-amber-400/30' : style.chip}`}>
          {gate ? (
            <span className="inline-flex items-center gap-1">
              <Lock className="w-2.5 h-2.5" />
              Approval gate
            </span>
          ) : (
            style.label
          )}
        </span>
        {appMeta && (
          <AppBadge appId={appMeta.id} size="sm" />
        )}
        {duration != null && (
          <span className="inline-flex items-center gap-0.5 text-gray-500 font-mono">
            <Timer className="w-2.5 h-2.5" />
            {formatDuration(duration)}
          </span>
        )}
        {task.deps.length > 0 && (
          <span className="ml-auto inline-flex items-center gap-0.5 text-gray-600" title={`Waits for ${task.deps.length} task(s)`}>
            <GitMerge className="w-2.5 h-2.5" />
            {task.deps.length}
          </span>
        )}
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

function GoalNode({ data }) {
  return (
    <div className="rounded-2xl border border-[#eb6920]/50 bg-[#150f0b] px-3 py-2.5 shadow-[0_0_20px_rgba(235,105,32,0.15)]" style={{ width: NODE_W - 24 }}>
      <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-[#eb6920] mb-1">
        <Target className="w-3 h-3" />
        Goal
      </div>
      <div className="text-[11px] font-semibold text-white leading-snug line-clamp-3">{data.goal}</div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { task: TaskNode, goal: GoalNode };

function layout(tasks) {
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const depthCache = {};
  const depth = (t) => {
    if (depthCache[t.id] != null) return depthCache[t.id];
    const deps = t.deps.filter((d) => byId[d]);
    depthCache[t.id] = deps.length ? 1 + Math.max(...deps.map((d) => depth(byId[d]))) : 0;
    return depthCache[t.id];
  };
  const columns = {};
  tasks.forEach((t) => (columns[depth(t)] ||= []).push(t));
  const positions = {};
  Object.entries(columns).forEach(([col, list]) => {
    list.forEach((t, i) => {
      positions[t.id] = { x: (Number(col) + 1) * COL_GAP, y: (i - (list.length - 1) / 2) * ROW_GAP };
    });
  });
  return positions;
}

const edgeStyle = (color, opacity = 1) => ({ stroke: color, strokeWidth: 1.5, opacity, transition: 'stroke 0.5s' });

export default function TaskGraph({ tasks, goal, clock, onSelect }) {
  const { nodes, edges } = useMemo(() => {
    const pos = layout(tasks);
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    const roots = tasks.filter((t) => !t.deps.some((d) => byId[d]));
    return {
      nodes: [
        { id: '__goal', type: 'goal', position: { x: 12, y: 0 }, data: { goal }, draggable: false },
        ...tasks.map((t) => ({
          id: t.id,
          type: 'task',
          position: pos[t.id],
          data: { task: t, duration: taskDuration(t, clock), clickable: !!onSelect },
          draggable: false,
        })),
      ],
      edges: [
        ...roots.map((t) => ({
          id: `__goal-${t.id}`,
          source: '__goal',
          target: t.id,
          style: edgeStyle('#eb6920', 0.5),
        })),
        ...tasks.flatMap((t) =>
          t.deps
            .filter((d) => byId[d])
            .map((d) => {
              const src = byId[d];
              const live = t.status === 'running' || t.status === 'awaiting';
              const color = t.status === 'failed' ? '#ef4444' : src.status === 'done' ? '#eb6920' : 'rgba(255,255,255,0.15)';
              const flowLabel = getDataFlowLabel(src, t);
              return {
                id: `${d}-${t.id}`,
                source: d,
                target: t.id,
                animated: live,
                style: edgeStyle(color, src.status === 'done' ? 0.8 : 1),
                ...(flowLabel
                  ? {
                      label: flowLabel,
                      labelStyle: {
                        fill: '#ff9a5c',
                        fontSize: 9,
                        fontWeight: 700,
                        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
                      },
                      labelBgStyle: {
                        fill: '#150f0b',
                        fillOpacity: 0.95,
                        stroke: 'rgba(235, 105, 32, 0.45)',
                        strokeWidth: 1,
                        rx: 5,
                        ry: 5,
                      },
                      labelBgPadding: [6, 2],
                      labelBgBorderRadius: 5,
                    }
                  : {}),
              };
            })
        ),
      ],
    };
  }, [tasks, goal, clock, onSelect]);

  if (!tasks.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-sm text-gray-500">
        <span className="w-8 h-8 rounded-full border-2 border-[#eb6920]/30 border-t-[#eb6920] animate-spin" />
        Planner is building the task graph…
      </div>
    );
  }

  return (
    <ReactFlow
      key={tasks.length}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      colorMode="dark"
      fitView
      fitViewOptions={{ padding: 0.08, maxZoom: 1.1 }}
      nodesConnectable={false}
      elementsSelectable={false}
      onNodeClick={onSelect ? (_, node) => node.type === 'task' && onSelect(node.data.task) : undefined}
      zoomOnScroll={false}
      preventScrolling={false}
      style={{ background: 'transparent' }}
    >
      <Background color="rgba(255,255,255,0.06)" gap={24} />
    </ReactFlow>
  );
}
