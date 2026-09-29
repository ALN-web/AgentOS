import React from 'react';
import { Clapperboard, Pause, Play, RotateCcw, X } from 'lucide-react';
import { formatClock } from '../../components/ui';

const SPEEDS = [1, 2, 4];

export default function ReplayBar({ replay, total, onChange, onExit }) {
  const { t, playing, speed } = replay;
  const ended = t >= total;
  const toggle = () => (ended ? onChange({ t: 0, playing: true }) : onChange({ playing: !playing }));

  return (
    <div className="sticky top-[104px] lg:top-4 z-30 mb-4 rounded-2xl border border-[#eb6920]/40 bg-[#120d0a]/95 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.6)] px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#eb6920]">
          <Clapperboard className="w-3.5 h-3.5" />
          Replay
        </span>

        <button
          onClick={toggle}
          aria-label={playing ? 'Pause replay' : 'Play replay'}
          className="btn-orange w-9 h-9 rounded-xl flex items-center justify-center"
        >
          {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 fill-current" />}
        </button>
        <button
          onClick={() => onChange({ t: 0, playing: true })}
          aria-label="Restart replay"
          className="btn-dark w-9 h-9 rounded-xl flex items-center justify-center"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
        <div className="flex rounded-xl border border-white/10 overflow-hidden" role="group" aria-label="Replay speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              onClick={() => onChange({ speed: s })}
              aria-pressed={speed === s}
              className={`px-2.5 py-2 text-xs font-semibold transition-colors ${speed === s ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-white'}`}
            >
              {s}×
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-1 min-w-[200px]">
          <span className="text-[11px] font-mono text-gray-400 tabular-nums">{formatClock(Math.min(t, total))}</span>
          <input
            type="range"
            min={0}
            max={total}
            step={100}
            value={Math.min(t, total)}
            onChange={(e) => onChange({ t: Number(e.target.value), playing: false })}
            aria-label="Replay position"
            className="flex-1 accent-[#eb6920] cursor-pointer"
          />
          <span className="text-[11px] font-mono text-gray-500 tabular-nums">{formatClock(total)}</span>
        </div>

        <button onClick={onExit} className="btn-dark px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5">
          <X className="w-3.5 h-3.5" />
          Exit replay
        </button>
      </div>
      <p className="text-[10px] text-gray-500 mt-2">
        You are watching a replay of this mission. Every panel shows the mission as it was at this moment, including the decisions you made.
      </p>
    </div>
  );
}
