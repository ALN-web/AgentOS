import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Background, Handle, Position, ReactFlow } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AlertTriangle, ArrowRight, Network } from 'lucide-react';
import { AGENTS, AGENT_BY_ID } from '../data/agents';
import { useMissions } from '../store/MissionStore';
import { ACTIVE_STATUSES } from '../engine/engine';
import { AgentIcon, EmptyState, StatusPill, agentName, formatClock } from '../components/ui';
import { activeAgents, activeRecovery } from '../engine/selectors';

// Execution sits in the middle and coordinates everyone; a few direct lines show
// the other collaborations that happen during a mission.
const LINKS = [
  ...AGENTS.filter((a) => a.id !== 'execution').map((a) => ['execution', a.id]),
  ['planner', 'research'],
  ['recovery', 'planner'],
  ['verification', 'planner'],
  ['critic', 'planner'],
];

// While a failure is being handled, work flows Recovery -> Planner -> Execution.
const RECOVERY_PATH = new Set(['recovery-planner', 'execution-planner']);
const RECOVERY_NODES = new Set(['recovery', 'planner', 'execution']);

const RADIUS = 250;

// Both handles sit in the node centre so straight edges meet in the middle.
const CENTER = { top: '50%', left: '50%', bottom: 'auto', transform: 'translate(-50%, -50%)', opacity: 0 };

function AgentNode({ data }) {
  const { agent, state, current, confidence, selected, onPath } = data;
  const working = state === 'working';
  const glow = onPath ? '#ef4444' : agent.color;
  return (
    <div
      className={`w-[184px] rounded-2xl border px-3 py-3 bg-[#0f0d15] transition-all duration-300 cursor-pointer ${
        selected ? 'ring-2 ring-[#eb6920]/60' : ''
      }`}
      style={{
        borderColor: onPath ? '#ef4444aa' : working ? agent.color : 'rgba(255,255,255,0.1)',
        boxShadow: working || onPath ? `0 0 28px ${glow}55` : 'none',
      }}
    >
      <Handle type="target" position={Position.Top} style={CENTER} />
      <div className="flex items-center gap-2.5">
        <AgentIcon id={agent.id} />
        <div className="min-w-0">
          <div className="text-xs font-bold text-white">{agent.name}</div>
          <div className="text-[10px] text-gray-500 truncate">{agent.role}</div>
        </div>
        <span className="ml-auto relative flex w-2 h-2 shrink-0" aria-hidden>
          {working && <span className="absolute inset-0 rounded-full animate-ping opacity-70" style={{ background: agent.color }} />}
          <span
            className="relative w-2 h-2 rounded-full"
            style={{ background: working ? agent.color : state === 'waiting' ? '#fbbf24' : state === 'failed' ? '#ef4444' : '#4b5563' }}
          />
        </span>
      </div>
      <div className="mt-2 rounded-lg bg-black/40 border border-white/5 px-2 py-1.5">
        <div
          className={`text-[9px] font-bold uppercase tracking-wider ${
            state === 'failed' ? 'text-red-300' : working ? 'text-white' : state === 'waiting' ? 'text-amber-300' : 'text-gray-500'
          }`}
        >
          {onPath ? 'Recovery path' : { working: 'Working', waiting: 'Waiting on you', failed: 'Task failed', idle: 'Idle' }[state]}
        </div>
        <div className="text-[10px] text-gray-400 truncate">{current || 'No active task'}</div>
      </div>
      <div className="mt-2">
        <div className="flex justify-between text-[9px] text-gray-500 mb-1">
          <span>Confidence</span>
          <span className="font-mono text-gray-300">{Math.round(confidence * 100)}%</span>
        </div>
        <div className="h-1 rounded-full bg-white/[0.07] overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${confidence * 100}%`, background: agent.color }} />
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} style={CENTER} />
    </div>
  );
}

const nodeTypes = { agent: AgentNode };

function agentStats(mission) {
  const stats = Object.fromEntries(AGENTS.map((a) => [a.id, { confidence: a.confidence, messages: 0, tasks: 0, done: 0, current: null }]));
  if (!mission) return { stats, working: new Set() };

  mission.events.forEach((e) => stats[e.agent] && (stats[e.agent].messages += 1));
  mission.tasks.forEach((t) => {
    if (!stats[t.agent]) return;
    stats[t.agent].tasks += 1;
    if (t.status === 'done') stats[t.agent].done += 1;
    if (['running', 'awaiting', 'failed'].includes(t.status)) stats[t.agent].current = t.title;
    if (t.status === 'failed') stats[t.agent].failed = true;
  });
  const pending = mission.approvals.find((a) => a.status === 'pending');
  if (pending) stats.approval.current = pending.title;
  const rec = activeRecovery(mission);
  if (rec) stats.recovery.current = `Fixing: ${rec.task}`;

  // Confidence dips for an agent whose task just failed, until Recovery fixes it.
  mission.tasks
    .filter((t) => t.status === 'failed')
    .forEach((t) => stats[t.agent] && (stats[t.agent].confidence = Math.max(0.4, stats[t.agent].confidence - 0.3)));

  return { stats, working: mission.paused ? new Set() : activeAgents(mission) };
}

export default function Workforce() {
  const { missions } = useMissions();
  const defaultMission = missions.find((m) => ACTIVE_STATUSES.includes(m.status)) || missions[0];
  const [missionId, setMissionId] = useState(null);
  const [selectedId, setSelectedId] = useState('execution');
  const mission = missions.find((m) => m.id === missionId) || defaultMission;

  const { stats, working } = agentStats(mission);
  const recovering = !!(mission && activeRecovery(mission));
  const workingKey = [...working].sort().join(',');
  const detailKey = AGENTS.map((a) => `${stats[a.id].confidence}:${stats[a.id].current}`).join('|');
  const stateOf = (id) =>
    working.has(id) ? (id === 'approval' && mission?.status === 'awaiting_approval' ? 'waiting' : 'working') : stats[id].failed ? 'failed' : 'idle';

  const { nodes, edges } = useMemo(() => {
    const others = AGENTS.filter((a) => a.id !== 'execution');
    const pos = { execution: { x: 0, y: 0 } };
    others.forEach((a, i) => {
      const angle = (i / others.length) * Math.PI * 2 - Math.PI / 2;
      pos[a.id] = { x: Math.cos(angle) * RADIUS * 1.35, y: Math.sin(angle) * RADIUS };
    });
    return {
      nodes: AGENTS.map((a) => ({
        id: a.id,
        type: 'agent',
        position: pos[a.id],
        draggable: false,
        data: {
          agent: a,
          state: stateOf(a.id),
          current: stats[a.id].current,
          confidence: stats[a.id].confidence,
          selected: a.id === selectedId,
          onPath: recovering && RECOVERY_NODES.has(a.id),
        },
      })),
      edges: LINKS.map(([s, t]) => {
        const id = `${s}-${t}`;
        const path = recovering && RECOVERY_PATH.has(id);
        const live = path || (working.has(s) && working.has(t));
        return {
          id,
          source: s,
          target: t,
          type: 'straight',
          animated: live,
          style: {
            stroke: path ? '#ef4444' : live ? '#eb6920' : 'rgba(255,255,255,0.08)',
            strokeWidth: path ? 2.5 : live ? 2 : 1,
            transition: 'stroke 0.4s',
          },
        };
      }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workingKey, detailKey, selectedId, recovering, mission?.status]);

  const agent = AGENT_BY_ID[selectedId];
  const s = stats[selectedId];
  const recent = mission ? mission.events.filter((e) => e.agent === selectedId).slice(-4).reverse() : [];
  const latest = mission?.events[mission.events.length - 1];

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Workforce</h1>
          <p className="text-sm text-gray-400 mt-1">
            Eight agents, one team. Lines light up when agents work together. Pick a mission to see who is doing what.
          </p>
        </div>
        {missions.length > 0 && (
          <select
            value={mission?.id}
            onChange={(e) => setMissionId(e.target.value)}
            aria-label="Mission"
            className="bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-[#eb6920]/60 max-w-full md:max-w-sm"
          >
            {missions.map((m) => (
              <option key={m.id} value={m.id}>
                {m.goal}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
        <div className="xl:col-span-8 glass-card rounded-2xl overflow-hidden flex flex-col relative">
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 min-h-[52px]">
            {mission && <StatusPill status={mission.status} paused={mission.paused} />}
            {recovering && (
              <span className="hidden md:inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-300 whitespace-nowrap">
                <AlertTriangle className="w-3.5 h-3.5" />
                Recovery → Planner → Execution
              </span>
            )}
            {latest && (
              <span className="text-xs text-gray-400 truncate">
                <span className="font-semibold" style={{ color: AGENT_BY_ID[latest.agent]?.color }}>
                  {agentName(latest.agent)}:
                </span>{' '}
                {latest.text}
              </span>
            )}
          </div>
          <div className="h-[460px] sm:h-[580px]">
            {missions.length === 0 && (
              <EmptyState icon={Network} title="No missions yet" className="absolute inset-x-0 top-24 z-10 pointer-events-none">
                Launch a mission to watch the agents collaborate.
              </EmptyState>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              colorMode="dark"
              fitView
              fitViewOptions={{ padding: 0.12 }}
              nodesConnectable={false}
              zoomOnScroll={false}
              preventScrolling={false}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              style={{ background: 'transparent' }}
            >
              <Background color="rgba(255,255,255,0.05)" gap={28} />
            </ReactFlow>
          </div>
        </div>

        <div className="xl:col-span-4 glass-card rounded-2xl p-5 sm:p-6">
          <div className="flex items-center gap-3 mb-4">
            <AgentIcon id={agent.id} size="lg" />
            <div>
              <h2 className="text-lg font-bold text-white">{agent.name} Agent</h2>
              <p className="text-xs text-gray-400">{agent.role}</p>
            </div>
          </div>
          <p className="text-sm text-gray-300 leading-relaxed mb-5">{agent.description}</p>

          <div className="grid grid-cols-3 gap-2 mb-6">
            {[
              ['Confidence', `${Math.round(s.confidence * 100)}%`],
              ['Tasks', `${s.done}/${s.tasks}`],
              ['Messages', s.messages],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-black/40 border border-white/5 p-3">
                <div className="text-[10px] text-gray-500 mb-1">{label}</div>
                <div className="text-base font-bold text-white tabular-nums">{value}</div>
              </div>
            ))}
          </div>

          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500 mb-3">Recent messages</div>
          {recent.length === 0 ? (
            <p className="text-xs text-gray-600">No messages from this agent in this mission yet.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((e) => (
                <li key={e.id} className="rounded-xl bg-black/40 border border-white/5 p-3">
                  <div className="text-[10px] font-mono text-gray-600 mb-1">{formatClock(e.t)}</div>
                  <p className="text-xs text-gray-300 leading-relaxed">{e.text}</p>
                </li>
              ))}
            </ul>
          )}

          {mission && (
            <Link to={`/app/missions/${mission.id}`} className="mt-6 inline-flex items-center gap-1.5 text-xs font-semibold text-[#eb6920] hover:text-[#ff9a5c]">
              Open mission <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
