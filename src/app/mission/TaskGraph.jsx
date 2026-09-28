import React, { useMemo } from 'react';
import { Background, Handle, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Check, Clock, Loader2, ShieldAlert, SkipForward, X } from 'lucide-react';
import { AgentIcon, agentName } from '../../components/ui';

const NODE_W = 180;
const COL_GAP = 212;
const ROW_GAP = 84;

const STATUS_STYLE = {
  pending: { box: 'border-white/10 bg-[#0f0d15]', icon: Clock, iconCls: 'text-gray-500' },
  running: { box: 'border-[#eb6920] bg-[#1a120d] shadow-[0_0_24px_rgba(235,105,32,0.35)]', icon: Loader2, iconCls: 'text-[#eb6920] animate-spin' },
  awaiting: { box: 'border-amber-400 bg-[#1a160b] shadow-[0_0_24px_rgba(251,191,36,0.25)]', icon: ShieldAlert, iconCls: 'text-amber-300' },
  done: { box: 'border-emerald-400/40 bg-[#0c1410]', icon: Check, iconCls: 'text-emerald-400' },
  failed: { box: 'border-red-500 bg-[#1a0d0d] shadow-[0_0_24px_rgba(239,68,68,0.35)]', icon: X, iconCls: 'text-red-400' },
  skipped: { box: 'border-white/5 bg-[#0c0b10] opacity-40', icon: SkipForward, iconCls: 'text-gray-500' },
};

function TaskNode({ data }) {
  const style = STATUS_STYLE[data.status] || STATUS_STYLE.pending;
  const Icon = style.icon;
  return (
    <div className={`rounded-2xl border px-3 py-2.5 transition-all duration-500 ${style.box}`} style={{ width: NODE_W }}>
      <Handle type="target" position={Position.Left} className="!opacity-0" />
      <div className="flex items-center gap-2.5">
        <AgentIcon id={data.agent} size="sm" />
        <div className="min-w-0 flex-1">
          <div className={`text-[11px] leading-tight font-semibold text-white line-clamp-2 ${data.status === 'skipped' ? 'line-through' : ''}`}>{data.title}</div>
          <div className="text-[10px] text-gray-500 truncate">{agentName(data.agent)}</div>
        </div>
        <Icon className={`w-3.5 h-3.5 shrink-0 ${style.iconCls}`} />
      </div>
      <Handle type="source" position={Position.Right} className="!opacity-0" />
    </div>
  );
}

const nodeTypes = { task: TaskNode };

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
      positions[t.id] = { x: Number(col) * COL_GAP, y: (i - (list.length - 1) / 2) * ROW_GAP };
    });
  });
  return positions;
}

export default function TaskGraph({ tasks }) {
  const { nodes, edges } = useMemo(() => {
    const pos = layout(tasks);
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    return {
      nodes: tasks.map((t) => ({ id: t.id, type: 'task', position: pos[t.id], data: t, draggable: false })),
      edges: tasks.flatMap((t) =>
        t.deps
          .filter((d) => byId[d])
          .map((d) => {
            const src = byId[d];
            const live = t.status === 'running' || t.status === 'awaiting';
            const color = t.status === 'failed' ? '#ef4444' : src.status === 'done' ? '#eb6920' : 'rgba(255,255,255,0.15)';
            return {
              id: `${d}-${t.id}`,
              source: d,
              target: t.id,
              animated: live,
              style: { stroke: color, strokeWidth: 1.5, opacity: src.status === 'done' ? 0.8 : 1 },
            };
          })
      ),
    };
  }, [tasks]);

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
      zoomOnScroll={false}
      preventScrolling={false}
      style={{ background: 'transparent' }}
    >
      <Background color="rgba(255,255,255,0.06)" gap={24} />
    </ReactFlow>
  );
}
