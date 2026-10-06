import { describe, it, expect } from 'vitest';
import { presentationModel } from './ApprovalCard';

describe('ApprovalCard - Presentation & Fallback Model', () => {
  const missionWithDraft = {
    id: 'm1',
    tasks: [
      {
        id: 't1',
        output: {
          draft_id: 'draft123',
          to: 'fallback@example.com',
          subject: 'Fallback Subject',
          body: 'Fallback Body'
        }
      }
    ]
  };

  it('renders direct payload fields', () => {
    const raw = {
      to: 'direct@example.com',
      subject: 'Direct Subject',
      body: 'Direct Body'
    };
    const pm = presentationModel(raw, null);
    expect(pm.to).toBe('direct@example.com');
    expect(pm.subject).toBe('Direct Subject');
    expect(pm.body).toBe('Direct Body');
  });

  it('safely handles missing draft output without crashing', () => {
    const raw = { draft_id: 'draft999' };
    const pm = presentationModel(raw, null); // no mission
    expect(pm.draft_id).toBe('draft999');
    expect(pm.to).toBeUndefined();
    expect(pm.subject).toBeUndefined();
  });

  it('resolves draft task output', () => {
    const raw = { draft_id: 'draft123' };
    const pm = presentationModel(raw, missionWithDraft);
    expect(pm.to).toBe('fallback@example.com');
    expect(pm.subject).toBe('Fallback Subject');
    expect(pm.body).toBe('Fallback Body');
  });

  it('redacts tokens from the presentation model', () => {
    const raw = {
      to: 'friend@example.com',
      subject: 'Secret Token inside',
      body: 'Here is your token: ya29.a0Ad52N3...',
    };
    const pm = presentationModel(raw, null);
    expect(pm.body).toBe('[REDACTED]');
    expect(pm.to).toBe('friend@example.com');
    expect(pm.subject).toBe('Secret Token inside');
  });
});

import { diffs } from './ApprovalCard';

describe('ApprovalCard - Editable Edits (diffs)', () => {
  it('identifies an edited "to" field', () => {
    const original = { to: 'old@example.com', recipients: null };
    const next = { to: 'new@example.com', recipients: null };
    const result = diffs(original, next);
    expect(result).toEqual(
      expect.arrayContaining([
        { field: 'To', from: 'old@example.com', to: 'new@example.com' }
      ])
    );
  });

  it('preserves subject and body edit diffs', () => {
    const original = { subject: 'Old Sub', body: 'Old Body', recipients: null };
    const next = { subject: 'New Sub', body: 'New Body', recipients: null };
    const result = diffs(original, next);
    
    expect(result).toEqual(
      expect.arrayContaining([
        { field: 'Subject', from: 'Old Sub', to: 'New Sub' },
        { field: 'Message', from: 'Original draft', to: 'Edited by you' }
      ])
    );
  });
});
