import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Check, CheckCircle2, Info, Loader2, Pencil, ShieldAlert, X, XCircle } from 'lucide-react';
import { useMission, useMissions } from '../store/MissionStore';
import { agentName, timeAgo } from './ui';

const RISK = {
  low: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
  medium: 'text-amber-300 border-amber-400/30 bg-amber-400/10',
  high: 'text-red-300 border-red-400/30 bg-red-400/10',
};

const RESOLVED = {
  approved: { label: 'Approved', cls: 'text-emerald-300', note: 'Approval granted. AgentOS resumed execution.', icon: CheckCircle2 },
  edited: { label: 'Approved with edits', cls: 'text-emerald-300', note: 'Approval granted with your edits. AgentOS resumed execution.', icon: CheckCircle2 },
  rejected: { label: 'Rejected', cls: 'text-red-300', note: 'Rejected. Nothing was sent, and AgentOS re-planned without this action.', icon: XCircle },
};

export function recipientsLabel(p) {
  return p.recipients != null ? `${p.recipients} ${p.audience}` : p.to;
}

// Field-level differences between what the agent proposed and what was approved.
export function diffs(original, next) {
  if (!original) return [];
  const out = [];
  if (original.recipients !== next.recipients) out.push({ field: 'Recipients', from: recipientsLabel(original), to: recipientsLabel(next) });
  if (original.to !== next.to && original.recipients == null && next.recipients == null) out.push({ field: 'To', from: original.to, to: next.to });
  if (original.subject !== next.subject) out.push({ field: 'Subject', from: original.subject, to: next.subject });
  if (original.body !== next.body) out.push({ field: 'Message', from: 'Original draft', to: 'Edited by you' });
  const origSummary = original.summary || original.title;
  const nextSummary = next.summary || next.title;
  if (origSummary && nextSummary && origSummary !== nextSummary) out.push({ field: 'Title', from: origSummary, to: nextSummary });
  if (original.start && next.start && original.start !== next.start) out.push({ field: 'Start Time', from: original.start, to: next.start });
  return out;
}

function Diff({ rows }) {
  if (!rows.length) return null;
  return (
    <div className="mt-3 rounded-xl border border-[#eb6920]/25 bg-[#eb6920]/[0.04] p-3 space-y-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-[#ff9a5c]">Your changes</div>
      {rows.map((r) => (
        <div key={r.field} className="text-xs">
          <div className="text-[10px] text-gray-500 mb-1">{r.field}</div>
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr] gap-1.5 sm:gap-2 items-center">
            <div className="rounded-lg border border-white/5 bg-black/40 px-2.5 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-gray-600">Original</div>
              <div className="text-gray-400 line-through decoration-gray-600 break-words">{r.from}</div>
            </div>
            <ArrowRight className="hidden sm:block w-3.5 h-3.5 text-[#eb6920]" />
            <div className="rounded-lg border border-[#eb6920]/30 bg-black/40 px-2.5 py-1.5">
              <div className="text-[9px] uppercase tracking-wider text-[#ff9a5c]">Modified</div>
              <div className="text-white font-medium break-words">{r.to}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Row({ label, children, align = 'center' }) {
  return (
    <div className={`flex gap-2 ${align === 'start' ? 'items-start' : 'items-center'}`}>
      <span className="text-gray-500 w-16 shrink-0">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function presentationModel(rawPayload, mission) {
  let p = { ...rawPayload };
  if (p.draft_id && !p.to && !p.subject && !p.body) {
    if (mission && mission.tasks) {
      const draftTask = mission.tasks.find((t) => t.output && t.output.draft_id === p.draft_id);
      if (draftTask && draftTask.output) {
        p.to = rawPayload.to || draftTask.output.to;
        p.subject = rawPayload.subject || draftTask.output.subject;
        p.body = rawPayload.body || draftTask.output.body;
      }
    }
  }

  const isSecret = (v) => typeof v === 'string' && (v.includes('ya29.') || v.includes('Bearer '));
  const safeStr = (v) => (isSecret(v) ? '[REDACTED]' : v);

  return {
    ...p,
    summary: safeStr(p.summary),
    title: safeStr(p.title),
    start: safeStr(p.start),
    from: safeStr(p.from),
    to: safeStr(p.to),
    audience: safeStr(p.audience),
    subject: safeStr(p.subject),
    body: safeStr(p.body),
    draft_id: p.draft_id,
  };
}

// readOnly: shown during a replay, where decisions are the recorded ones.
export default function ApprovalCard({ approval, showMission = false, readOnly = false, compact = false, onDecide }) {
  const { decide } = useMissions();
  const mission = useMission(approval.missionId);

  const raw = approval.payload || {};
  const p = presentationModel(raw, mission);

  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(p.subject || '');
  const [body, setBody] = useState(p.body || '');
  const [to, setTo] = useState(p.to || '');
  const [recipients, setRecipients] = useState(p.recipients);
  const [summary, setSummary] = useState(p.summary || p.title || '');
  const [start, setStart] = useState(p.start || '');
  const [inFlight, setInFlight] = useState(false);
  const [error, setError] = useState(null);

  const pending = approval.status === 'pending';
  const resolved = RESOLVED[approval.status];
  const max = p.recipients;
  const validRecipients = p.recipients == null || (Number.isInteger(recipients) && recipients >= 1 && recipients <= max);

  const edits = {
    ...(p.subject !== undefined ? { subject } : {}),
    ...(p.body !== undefined ? { body } : {}),
    ...(p.to !== undefined && p.recipients == null ? { to } : {}),
    ...(p.recipients != null ? { recipients } : {}),
    ...(p.summary !== undefined ? { summary } : {}),
    ...(p.title !== undefined ? { title: summary } : {}),
    ...(p.start !== undefined ? { start } : {}),
  };
  const draftDiffs = editing ? diffs(p, { ...p, ...edits }) : [];
  const appliedDiffs = diffs(approval.original, p);

  const act = async (decision) => {
    setInFlight(true);
    setError(null);
    try {
      if (onDecide) {
        await onDecide(approval.id, decision, decision === 'edit' ? edits : undefined);
      } else {
        await decide(approval.missionId, approval.id, decision, decision === 'edit' ? edits : undefined);
      }
      setEditing(false);
    } catch (err) {
      if (err.status === 409 || err.code === 409) {
        setError('This approval has already been decided.');
      } else {
        setError(err.message || 'Something went wrong.');
      }
    } finally {
      setInFlight(false);
    }
  };

  const input = 'bg-black/60 border border-white/10 rounded-md px-2 py-1 text-white focus:outline-none focus:border-[#eb6920]/60';

  return (
    <div
      className={`rounded-2xl border p-4 ${
        pending ? 'border-amber-400/40 bg-[#15120a]/80 shadow-[0_0_30px_rgba(251,191,36,0.08)]' : 'border-white/10 bg-white/[0.02]'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-300 shrink-0">
            <ShieldAlert className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-amber-300/80 flex items-center">
              {approval.isLive && <span className="bg-red-500/20 text-red-400 border border-red-500/30 px-1.5 py-0.5 rounded mr-1.5 leading-none">LIVE</span>}
              <span>{pending ? 'Action requires approval' : 'Approval decision'} · {agentName(approval.agent)}</span>
            </div>
            <div className="text-sm font-semibold text-white">{approval.title}</div>
            {showMission && (
              <Link to={`/app/missions/${approval.missionId}`} className="text-[11px] text-gray-500 hover:text-[#eb6920] truncate block">
                {approval.goal}
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${RISK[approval.risk]}`}>{approval.risk} risk</span>
          {approval.category && <span className="text-[10px] text-gray-400">{approval.category}</span>}
          {resolved && <span className={`text-[11px] font-semibold ${resolved.cls}`}>{resolved.label}</span>}
        </div>
      </div>

      {!compact && (
        <div className="flex items-start gap-2 text-xs text-gray-300 mb-3">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-500" />
          <p>
            <span className="text-gray-500">Why approval is required: </span>
            {approval.reason}
          </p>
        </div>
      )}

      {!(compact && !pending) && (
        <div className="rounded-xl bg-black/50 border border-white/5 p-3 text-xs space-y-1.5">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1">Proposed action</div>
          {(p.summary || p.title) && (
            <Row label="Title" align="start">
              {editing ? (
                <input value={summary} onChange={(e) => setSummary(e.target.value)} aria-label="Event Title" className={`${input} w-full`} />
              ) : (
                <span className="text-white font-medium">{p.summary || p.title}</span>
              )}
            </Row>
          )}
          {p.start && (
            <Row label="Start Time" align="start">
              {editing ? (
                <input value={start} onChange={(e) => setStart(e.target.value)} aria-label="Start Time" className={`${input} w-full font-mono text-[11px]`} />
              ) : (
                <span className="text-gray-300 font-mono text-[11px]">{p.start}</span>
              )}
            </Row>
          )}
          {p.from && (
            <Row label="From">
              <span className="text-gray-300 truncate block">{p.from}</span>
            </Row>
          )}
          {(p.to || p.recipients != null) && (
            <Row label="To">
              {editing && p.recipients != null ? (
                <span className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={max}
                    value={Number.isNaN(recipients) ? '' : recipients}
                    onChange={(e) => setRecipients(parseInt(e.target.value, 10))}
                    aria-label="Number of recipients"
                    className={`${input} w-20 tabular-nums`}
                  />
                  <span className="text-gray-400">{p.audience}</span>
                  <span className="text-[10px] text-gray-600">max {max}</span>
                </span>
              ) : editing && p.to !== undefined ? (
                <input value={to} onChange={(e) => setTo(e.target.value)} aria-label="To" className={`${input} w-full`} />
              ) : (
                <span className="text-gray-300 truncate block">{recipientsLabel(p)}</span>
              )}
            </Row>
          )}
          {p.subject !== undefined && (
            <Row label="Subject" align="start">
              {editing ? (
                <input value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject" className={`${input} w-full`} />
              ) : (
                <span className="text-white font-medium">{p.subject}</span>
              )}
            </Row>
          )}
          {!compact && p.body !== undefined && (
            <div className="pt-2 border-t border-white/5">
              {editing ? (
                <textarea
                  rows={6}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  aria-label="Message"
                  className={`${input} w-full py-1.5 text-gray-200 resize-none`}
                />
              ) : (
                <p className="text-gray-400 whitespace-pre-line leading-relaxed line-clamp-6">{p.body}</p>
              )}
            </div>
          )}
        </div>
      )}

      <Diff rows={pending ? draftDiffs : appliedDiffs} />

      {error && (
        <div className="mt-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      {pending && readOnly && (
        <div className="mt-4 text-[11px] text-gray-500">Replay: waiting for the decision you made in the live run.</div>
      )}

      {pending && !readOnly && (
        <div className="mt-4 flex flex-wrap gap-2">
          {editing ? (
            <>
              <button
                onClick={() => act('edit')}
                disabled={inFlight || !validRecipients}
                className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {inFlight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Approve with edits</span>
              </button>
              <button onClick={() => setEditing(false)} disabled={inFlight} className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold disabled:opacity-40">
                Cancel
              </button>
              {!validRecipients && <span className="self-center text-[11px] text-red-300">Recipients must be between 1 and {max}.</span>}
            </>
          ) : (
            <>
              <button
                onClick={() => act('approve')}
                disabled={inFlight}
                className="btn-orange px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none"
              >
                {inFlight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>Approve</span>
              </button>
              <button
                onClick={() => setEditing(true)}
                disabled={inFlight}
                className="btn-dark px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 disabled:opacity-40"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span>Edit</span>
              </button>
              <button
                onClick={() => act('reject')}
                disabled={inFlight}
                className="px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 text-red-300 border border-red-400/20 hover:bg-red-400/10 transition-colors disabled:opacity-40"
              >
                {inFlight ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                <span>Reject</span>
              </button>
            </>
          )}
        </div>
      )}

      {resolved && (
        <div className={`mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs border ${
          approval.status === 'rejected' ? 'border-red-400/20 bg-red-400/[0.05] text-red-200' : 'border-emerald-400/20 bg-emerald-400/[0.05] text-emerald-200'
        }`}>
          <resolved.icon className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">{resolved.note}</span>
          {!readOnly && <span className="text-[10px] text-gray-500 whitespace-nowrap">{timeAgo(approval.resolvedAt)}</span>}
        </div>
      )}
    </div>
  );
}
