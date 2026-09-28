import React from 'react';
import { AlertTriangle, CheckCircle2, ListChecks, XCircle } from 'lucide-react';

const ICONS = {
  done: { icon: CheckCircle2, cls: 'text-emerald-400' },
  warn: { icon: AlertTriangle, cls: 'text-amber-300' },
  failed: { icon: XCircle, cls: 'text-red-400' },
};

export default function VerificationCard({ checks }) {
  return (
    <div className="glass-card rounded-2xl p-5">
      <div className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
        <ListChecks className="w-4 h-4 text-emerald-400" />
        Verification
      </div>
      {checks.length === 0 ? (
        <p className="text-xs text-gray-600">Runs once the work is done. Nothing counts until it’s checked.</p>
      ) : (
        <ul className="space-y-2">
          {checks.map((c, i) => {
            const { icon: Icon, cls } = ICONS[c.status] || ICONS.done;
            return (
              <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cls}`} />
                {c.label}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
