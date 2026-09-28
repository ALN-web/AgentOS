import React from 'react';
import { TEMPLATES } from '../data/templates';
import TemplateCard from '../components/TemplateCard';
import { useMissions } from '../store/MissionStore';

export default function TemplatesPage() {
  const { openLauncher } = useMissions();
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Templates</h1>
        <p className="text-sm text-gray-400 mt-1">Ready-made missions. Pick one, adjust the goal, and launch.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {TEMPLATES.map((t) => (
          <TemplateCard key={t.id} template={t} height="h-[320px]" onSelect={(tpl) => openLauncher(tpl.goal)} />
        ))}
      </div>
    </div>
  );
}
