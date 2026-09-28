import React from 'react';
import { X, Play, Shield, Cpu, Activity, CheckCircle } from 'lucide-react';

export default function WatchDemoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl">
      <div className="relative w-full max-w-3xl bg-[#0e0c15] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 p-2 rounded-full bg-white/[0.05] hover:bg-white/[0.1] text-gray-400 hover:text-white transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Video simulation preview */}
        <div className="mb-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-[#eb6920]/10 border border-[#eb6920]/20 text-[11px] font-bold text-[#eb6920] mb-2 uppercase tracking-wider">
            <Activity className="w-3 h-3" />
            <span>Interactive Demo</span>
          </div>
          <h3 className="text-2xl font-bold text-white tracking-tight">
            AgentOS in Action: Autonomous Multi-Agent Swarm
          </h3>
        </div>

        {/* Video Player Frame */}
        <div className="relative w-full aspect-video rounded-2xl bg-black border border-white/10 overflow-hidden flex items-center justify-center group">
          <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
          
          <div className="relative z-10 flex flex-col items-center text-center p-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-[#eb6920] flex items-center justify-center text-white shadow-[0_0_30px_rgba(235,105,32,0.8)] cursor-pointer hover:scale-110 transition-transform">
              <Play className="w-6 h-6 fill-current ml-1" />
            </div>
            <div>
              <h4 className="text-base font-bold text-white">Full Workflow Simulation</h4>
              <p className="text-xs text-gray-400 max-w-sm mx-auto mt-1">
                Watch how Goal → Planner → Research → Execution → Verification → Recovery → Approval completes tasks end-to-end.
              </p>
            </div>
          </div>

          {/* Bottom Video Controls Mock */}
          <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between text-xs text-gray-400 font-mono">
            <span>01:45 / 03:20</span>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>1080p 60fps HD</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
