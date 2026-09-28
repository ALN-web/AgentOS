import React, { useState } from 'react';
import { ArrowUpRight, ChevronLeft, ChevronRight, Sparkles, Layers, Zap } from 'lucide-react';

export default function MissionTemplates({ onSelectTemplate }) {
  const [currentPage, setCurrentPage] = useState(0);

  const templates = [
    {
      id: 'deadline-os',
      name: 'DeadlineOS',
      category: 'Delivery',
      tagline: 'Mission-critical deadline compression',
      description: 'Breaks down multi-week deliverables into atomic parallel tasks, auto-assigns agent swarms, and guarantees delivery before cutoff times.',
      tags: ['Autonomous Gantt', 'Parallel Sprints', 'Auto-Merge'],
      image: '/assets/showcase_card_1.jpg',
      gradient: 'from-amber-500/20 to-orange-500/10'
    },
    {
      id: 'recovery-os',
      name: 'RecoveryOS',
      category: 'Self-Healing',
      tagline: 'Automated failure diagnostics & recovery',
      description: 'Intercepts production exceptions, identifies root causes, executes zero-downtime hot-patches, and rolls back corrupt state autonomously.',
      tags: ['Surgical Rollback', 'Root-Cause AI', 'Zero Downtime'],
      image: '/assets/showcase_card_2.jpg',
      gradient: 'from-blue-500/20 to-purple-500/10'
    },
    {
      id: 'event-rescue',
      name: 'EventRescue',
      category: 'Operations',
      tagline: 'Real-time venue & vendor emergency response',
      description: 'Handles last-minute venue cancellations, rebooks vendor logistics, updates guest itineraries, and reconciles invoices in real time.',
      tags: ['Vendor APIs', 'Real-time SMS', 'Contract Auto-Sign'],
      image: '/assets/showcase_card_3.jpg',
      gradient: 'from-emerald-500/20 to-teal-500/10'
    },
    {
      id: 'refund-pilot',
      name: 'RefundPilot',
      category: 'Finance',
      tagline: 'Autonomous chargeback & claims resolution',
      description: 'Navigates airline, banking, and merchant policies to generate evidence dossiers, file dispute claims, and recover lost enterprise capital.',
      tags: ['Dispute Evidence', 'Policy Matching', 'Audit Replay'],
      image: '/assets/showcase_card_1.jpg',
      gradient: 'from-orange-500/20 to-rose-500/10'
    },
    {
      id: 'warranty-os',
      name: 'WarrantyOS',
      category: 'Asset Ops',
      tagline: 'Hardware lifecycle & replacement tracking',
      description: 'Scans device registries, tracks manufacturer coverage windows, triggers automated RMA returns, and dispatches replacement hardware.',
      tags: ['Hardware RMA', 'Coverage Index', 'Shipping Sync'],
      image: '/assets/showcase_card_2.jpg',
      gradient: 'from-cyan-500/20 to-blue-500/10'
    },
    {
      id: 'freelance-flow',
      name: 'FreelanceFlow',
      category: 'Contracting',
      tagline: 'Autonomous scope verification & billing',
      description: 'Synthesizes client contracts into verified milestone commits, tracks work telemetry, generates transparent invoices, and enforces escrows.',
      tags: ['Milestone Escrow', 'Scope Creep Guard', 'Auto-Invoice'],
      image: '/assets/showcase_card_3.jpg',
      gradient: 'from-violet-500/20 to-indigo-500/10'
    },
    {
      id: 'procure-os',
      name: 'ProcureOS',
      category: 'Supply Chain',
      tagline: 'Vendor comparison & automated PO generation',
      description: 'Compares RFP submissions across 50+ dimensions, drafts counter-proposals, checks supplier compliance, and executes purchase orders.',
      tags: ['RFP Matrix', 'Price Optimization', 'PO Dispatch'],
      image: '/assets/showcase_card_1.jpg',
      gradient: 'from-pink-500/20 to-red-500/10'
    },
    {
      id: 'team-os',
      name: 'TeamOS',
      category: 'Management',
      tagline: 'Cross-functional sprint orchestration',
      description: 'Synthesizes daily standup transcripts, resolves cross-team blockers, keeps Jira/GitHub synchronized, and drafts executive summaries.',
      tags: ['Slack/Git Sync', 'Blocker Detection', 'Weekly Briefing'],
      image: '/assets/showcase_card_2.jpg',
      gradient: 'from-teal-500/20 to-emerald-500/10'
    },
    {
      id: 'campus-os',
      name: 'CampusOS',
      category: 'Academic',
      tagline: 'Autonomous research compilation & citation',
      description: 'Performs multi-disciplinary literature reviews, validates LaTeX mathematical derivations, audits citation integrity, and formats papers.',
      tags: ['ArXiv Indexer', 'LaTeX Formatter', 'BibTeX Sync'],
      image: '/assets/showcase_card_3.jpg',
      gradient: 'from-sky-500/20 to-blue-500/10'
    },
    {
      id: 'launch-os',
      name: 'LaunchOS',
      category: 'Go-to-Market',
      tagline: 'Autonomous product release execution',
      description: 'Coordinates social media blitz, Product Hunt launches, documentation release, changelog distribution, and customer onboarding sequences.',
      tags: ['Omni-Channel', 'Changelog Sync', 'Traffic Spikes'],
      image: '/assets/showcase_card_1.jpg',
      gradient: 'from-amber-500/20 to-orange-500/10'
    }
  ];

  const visibleCardsCount = 3;
  const maxPages = Math.ceil(templates.length / visibleCardsCount);
  const currentTemplates = templates.slice(
    currentPage * visibleCardsCount,
    (currentPage + 1) * visibleCardsCount
  );

  return (
    <section id="mission-templates" className="py-24 relative overflow-hidden">
      <div className="max-w-[1240px] mx-auto px-6">
        
        {/* Header matching video Frame 00:14 */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-xs font-semibold uppercase tracking-wider text-[#eb6920] mb-3">
              <Layers className="w-3 h-3" />
              <span>Production Templates</span>
            </div>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">
              Pre-configured Mission Templates
            </h2>
            <p className="text-sm sm:text-base text-gray-400 leading-relaxed">
              Dive into the heart of innovation with our battle-tested templates. Explore a rich tapestry of pre-built workflows, policies, and multi-agent teams.
            </p>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setCurrentPage((p) => (p > 0 ? p - 1 : maxPages - 1))}
              className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-400 font-mono">
              0{currentPage + 1} / 0{maxPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => (p < maxPages - 1 ? p + 1 : 0))}
              className="w-10 h-10 rounded-full bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 flex items-center justify-center text-gray-300 hover:text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 3 Showcase Cards Grid (Matching Frame 00:14 - 00:16 in video) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {currentTemplates.map((template) => (
            <div
              key={template.id}
              onClick={() => onSelectTemplate(template)}
              className="group relative h-[420px] rounded-3xl overflow-hidden cursor-pointer border border-white/10 hover:border-[#eb6920]/40 transition-all duration-300 bg-[#0d0b13] flex flex-col justify-between"
            >
              {/* Background 3D Visual Artwork */}
              <div className="absolute inset-0 z-0">
                <img
                  src={template.image}
                  alt={template.name}
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 filter brightness-90 group-hover:brightness-100"
                />
                <div className={`absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent`} />
              </div>

              {/* Top-Right Arrow Action Button (Exact from Frame 00:14) */}
              <div className="relative z-10 p-5 flex justify-end">
                <div className="w-10 h-10 rounded-2xl bg-black/50 backdrop-blur-md border border-white/15 flex items-center justify-center text-white group-hover:bg-[#eb6920] group-hover:border-transparent group-hover:shadow-[0_0_15px_rgba(235,105,32,0.6)] transition-all">
                  <ArrowUpRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </div>
              </div>

              {/* Bottom Sliding Drawer Pill (Frame 00:15 - 00:16: slides up smoothly on hover!) */}
              <div className="relative z-10 p-4 transition-all duration-300 transform translate-y-6 group-hover:translate-y-0">
                <div className="p-5 rounded-2xl bg-black/80 backdrop-blur-xl border border-white/10 shadow-[0_15px_35px_rgba(0,0,0,0.8)] group-hover:border-[#eb6920]/30 transition-all">
                  
                  {/* Category Pill */}
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#eb6920] mb-1">
                    {template.category}
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-bold text-white mb-2 tracking-wide">
                    {template.name}
                  </h3>

                  {/* Description (reveals more on hover) */}
                  <p className="text-xs text-gray-300 leading-relaxed line-clamp-2 group-hover:line-clamp-none transition-all mb-3">
                    {template.description}
                  </p>

                  {/* Tags */}
                  <div className="flex flex-wrap gap-1.5 pt-2 border-t border-white/10">
                    {template.tags.map((tag, tIdx) => (
                      <span
                        key={tIdx}
                        className="text-[9px] font-medium px-2 py-0.5 rounded bg-white/[0.06] text-gray-300"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

            </div>
          ))}
        </div>

      </div>
    </section>
  );
}
