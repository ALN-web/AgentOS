import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Layers } from 'lucide-react';
import { TEMPLATES } from '../data/templates';
import { SectionLabel } from '../components/ui';
import TemplateCard from '../components/TemplateCard';
import { useMissions } from '../store/MissionStore';

const PER_PAGE = 3;

export default function Templates() {
  const { openLauncher } = useMissions();
  const [page, setPage] = useState(0);
  const pages = Math.ceil(TEMPLATES.length / PER_PAGE);
  const visible = TEMPLATES.slice(page * PER_PAGE, (page + 1) * PER_PAGE);

  return (
    <section id="templates" className="py-24 relative overflow-hidden scroll-mt-20">
      <div className="max-w-[1240px] mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div className="max-w-2xl">
            <SectionLabel icon={Layers}>Mission templates</SectionLabel>
            <h2 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight mb-4">One OS. Many missions.</h2>
            <p className="text-sm sm:text-base text-gray-400">
              Start from a ready-made mission. Every template runs on the same eight agents.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={() => setPage((p) => (p + pages - 1) % pages)}
              aria-label="Previous templates"
              className="w-10 h-10 rounded-full btn-dark flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-xs text-gray-400 font-mono tabular-nums">
              {page + 1} / {pages}
            </span>
            <button
              onClick={() => setPage((p) => (p + 1) % pages)}
              aria-label="Next templates"
              className="w-10 h-10 rounded-full btn-dark flex items-center justify-center"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {visible.map((t) => (
            <TemplateCard key={t.id} template={t} onSelect={(tpl) => openLauncher(tpl.goal)} />
          ))}
        </div>
      </div>
    </section>
  );
}
