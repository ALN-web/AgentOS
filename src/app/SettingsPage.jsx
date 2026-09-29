import React, { useState } from 'react';
import { usePreferences } from '../store/PreferencesStore';
import { Check, Plus, Trash2, X } from 'lucide-react';
import GoogleConnectControl from '../live/GoogleConnectControl';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TONES = ['Friendly', 'Formal'];

// Try to get timezones, fallback to a sensible list if unsupported
const TIMEZONES = typeof Intl.supportedValuesOf === 'function'
  ? Intl.supportedValuesOf('timeZone')
  : [Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'];

const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export default function SettingsPage() {
  const { preferences, updatePreferences } = usePreferences();
  
  // Local state for draft updates
  const [draft, setDraft] = useState(preferences);
  const [saved, setSaved] = useState(false);
  
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmails, setNewGroupEmails] = useState({});

  const save = () => {
    // Validate
    if (draft.workingHours.start >= draft.workingHours.end) {
      alert("Working hours start must be before end.");
      return;
    }
    if (draft.meetingLength <= 0) {
      alert("Meeting length must be greater than zero.");
      return;
    }
    if (draft.workingDays.length === 0) {
      alert("You must select at least one working day.");
      return;
    }
    updatePreferences(draft);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleUpdate = (updates) => {
    setDraft(prev => ({ ...prev, ...updates }));
    setSaved(false);
  };

  const handleWorkingHours = (field, value) => {
    setDraft(prev => ({ ...prev, workingHours: { ...prev.workingHours, [field]: value } }));
    setSaved(false);
  };

  const toggleDay = (day) => {
    setDraft(prev => {
      const days = prev.workingDays.includes(day)
        ? prev.workingDays.filter(d => d !== day)
        : [...prev.workingDays, day];
      return { ...prev, workingDays: days };
    });
    setSaved(false);
  };

  const addGroup = () => {
    const name = newGroupName.trim();
    if (!name) return;
    if (draft.groups.some(g => g.name.toLowerCase() === name.toLowerCase())) {
      alert("Group already exists.");
      return;
    }
    if (draft.groups.length >= 20) {
      alert("Too many groups.");
      return;
    }
    handleUpdate({ groups: [...draft.groups, { id: Date.now().toString(), name, emails: [] }] });
    setNewGroupName('');
  };

  const deleteGroup = (id) => {
    handleUpdate({ groups: draft.groups.filter(g => g.id !== id) });
  };

  const addEmailToGroup = (groupId) => {
    const email = (newGroupEmails[groupId] || '').trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      alert("Invalid email format.");
      return;
    }
    handleUpdate({
      groups: draft.groups.map(g => {
        if (g.id === groupId) {
          if (g.emails.includes(email)) return g;
          if (g.emails.length >= 50) return g;
          return { ...g, emails: [...g.emails, email] };
        }
        return g;
      })
    });
    setNewGroupEmails(prev => ({ ...prev, [groupId]: '' }));
  };

  const removeEmailFromGroup = (groupId, email) => {
    handleUpdate({
      groups: draft.groups.map(g => {
        if (g.id === groupId) {
          return { ...g, emails: g.emails.filter(e => e !== email) };
        }
        return g;
      })
    });
  };

  return (
    <div className="max-w-3xl">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-2">Preferences</h1>
        <p className="text-sm text-gray-400">AgentOS uses these details when understanding and planning missions.</p>
      </header>

      <div className="space-y-6">
        
        {/* Profile */}
        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Profile</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-gray-400 mb-1.5">Display name</span>
              <input 
                type="text" 
                maxLength={50}
                value={draft.displayName}
                onChange={e => handleUpdate({ displayName: e.target.value })}
                className="w-full max-w-sm bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60"
                placeholder="e.g. Alice"
              />
            </label>
            <label className="block">
              <span className="block text-xs font-medium text-gray-400 mb-1.5">Email signature</span>
              <textarea 
                maxLength={200}
                rows={3}
                value={draft.signature}
                onChange={e => handleUpdate({ signature: e.target.value })}
                className="w-full max-w-sm bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60 resize-none"
                placeholder="Best regards,&#10;Alice"
              />
            </label>
            <div>
              <span className="block text-xs font-medium text-gray-400 mb-1.5">Preferred tone</span>
              <div className="flex gap-2">
                {TONES.map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleUpdate({ tone: t })}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      draft.tone === t ? 'border-[#eb6920]/50 bg-[#eb6920]/10 text-white' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Schedule */}
        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Schedule</h2>
          <div className="space-y-4">
            <label className="block">
              <span className="block text-xs font-medium text-gray-400 mb-1.5">Timezone</span>
              <select 
                value={draft.timezone}
                onChange={e => handleUpdate({ timezone: e.target.value })}
                className="w-full max-w-sm bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60"
              >
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </label>

            <div>
              <span className="block text-xs font-medium text-gray-400 mb-1.5">Working days</span>
              <div className="flex flex-wrap gap-2">
                {DAYS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDay(d)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      draft.workingDays.includes(d) ? 'border-[#eb6920]/50 bg-[#eb6920]/10 text-white' : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                    }`}
                  >
                    {d.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <label className="block">
                <span className="block text-xs font-medium text-gray-400 mb-1.5">Start time</span>
                <input 
                  type="time" 
                  value={draft.workingHours.start}
                  onChange={e => handleWorkingHours('start', e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium text-gray-400 mb-1.5">End time</span>
                <input 
                  type="time" 
                  value={draft.workingHours.end}
                  onChange={e => handleWorkingHours('end', e.target.value)}
                  className="bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60"
                />
              </label>
            </div>

            <label className="block">
              <span className="block text-xs font-medium text-gray-400 mb-1.5">Default meeting length (minutes)</span>
              <input 
                type="number" 
                min="5"
                max="480"
                value={draft.meetingLength}
                onChange={e => handleUpdate({ meetingLength: parseInt(e.target.value, 10) || 30 })}
                className="w-32 bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60"
              />
            </label>
          </div>
        </section>

        {/* Contacts & Groups */}
        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-sm font-semibold text-white mb-4">Contacts & Groups</h2>
          
          <div className="space-y-4">
            {draft.groups.map(group => (
              <div key={group.id} className="border border-white/5 rounded-xl bg-black/40 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-white">{group.name}</h3>
                  <button onClick={() => deleteGroup(group.id)} className="p-1 text-gray-500 hover:text-red-400 transition-colors" aria-label="Delete group">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <ul className="space-y-1 mb-3">
                  {group.emails.map(email => (
                    <li key={email} className="flex items-center justify-between text-xs text-gray-300 bg-white/[0.02] px-2 py-1.5 rounded-md">
                      {email}
                      <button onClick={() => removeEmailFromGroup(group.id, email)} className="text-gray-500 hover:text-red-400 transition-colors" aria-label="Remove email">
                        <X className="w-3 h-3" />
                      </button>
                    </li>
                  ))}
                  {group.emails.length === 0 && <li className="text-xs text-gray-600 italic">No emails added yet.</li>}
                </ul>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    value={newGroupEmails[group.id] || ''}
                    onChange={e => setNewGroupEmails(prev => ({ ...prev, [group.id]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addEmailToGroup(group.id)}
                    placeholder="Add email address..."
                    className="flex-1 bg-black/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#eb6920]/60"
                  />
                  <button onClick={() => addEmailToGroup(group.id)} className="btn-dark px-3 py-1.5 rounded-lg text-xs font-semibold">
                    Add
                  </button>
                </div>
              </div>
            ))}

            <div className="flex items-center gap-2 pt-2">
              <input
                type="text"
                value={newGroupName}
                onChange={e => setNewGroupName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addGroup()}
                maxLength={30}
                placeholder="New group name (e.g. My team)"
                className="flex-1 max-w-sm bg-black/60 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-[#eb6920]/60"
              />
              <button onClick={addGroup} className="btn-dark px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1.5">
                <Plus className="w-4 h-4" />
                Add Group
              </button>
            </div>
          </div>
        </section>

        {/* Integrations */}
        <section className="glass-card rounded-2xl p-6">
          <h2 className="text-base font-bold text-white mb-1">Integrations & Connected Accounts</h2>
          <p className="text-xs text-gray-400 mb-4">Connect external services to allow AgentOS missions to execute actions on your behalf.</p>
          <GoogleConnectControl />
        </section>

        {/* Save */}
        <div className="flex items-center gap-4 pt-2">
          <button onClick={save} className="btn-orange px-6 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2">
            Save Preferences
            {saved && <Check className="w-4 h-4" />}
          </button>
          {saved && <span className="text-sm text-emerald-400">Saved successfully!</span>}
        </div>
      </div>
    </div>
  );
}
