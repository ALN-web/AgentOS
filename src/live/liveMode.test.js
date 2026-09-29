import { describe, expect, it, vi, beforeEach } from 'vitest';
import { backendEventToUi } from './useLiveMission';

describe('Live mode event mapping and proof formatting', () => {
  const startTime = 1700000000000;

  it('formats calendar tool completion events and extracts evidence', () => {
    const backendEvent = {
      seq: 3,
      type: 'TOOL_COMPLETED',
      agent: 'execution',
      payload: {
        task_key: 'cal',
        tool: 'calendar.create_event',
        status: 'success',
        output: {
          summary: 'Birthday dinner for 8',
          html_link: 'https://calendar.google.com/calendar/event?eid=evt_123',
        },
        evidence: [
          {
            type: 'calendar_event',
            source: 'google_calendar',
            label: "Created event 'Birthday dinner for 8'",
            url: 'https://calendar.google.com/calendar/event?eid=evt_123',
          },
        ],
      },
      created_at: new Date(startTime + 5000).toISOString(),
    };

    const uiEvent = backendEventToUi(backendEvent, startTime);
    expect(uiEvent.id).toBe('evt_3');
    expect(uiEvent.type).toBe('action');
    expect(uiEvent.text).toContain('Created Google Calendar event');
    expect(uiEvent.evidence).toHaveLength(1);
    expect(uiEvent.evidence[0].url).toBe('https://calendar.google.com/calendar/event?eid=evt_123');
    expect(uiEvent.t).toBe(5);
  });

  it('formats gmail tool completion events with draft evidence', () => {
    const backendEvent = {
      seq: 4,
      type: 'TOOL_COMPLETED',
      agent: 'execution',
      payload: {
        task_key: 'send',
        tool: 'gmail.send_draft',
        status: 'success',
        output: {
          to: '8 friends',
          subject: 'Birthday Dinner Celebration',
        },
        evidence: [
          {
            type: 'gmail_message',
            source: 'gmail',
            label: 'Sent invitation email',
            url: 'https://mail.google.com/mail/#all/msg_123',
          },
        ],
      },
      created_at: new Date(startTime + 12000).toISOString(),
    };

    const uiEvent = backendEventToUi(backendEvent, startTime);
    expect(uiEvent.type).toBe('action');
    expect(uiEvent.text).toContain('Dispatched emails via Gmail to 8 friends');
    expect(uiEvent.evidence[0].url).toContain('mail.google.com');
  });

  it('formats approval requested events with risk and reason', () => {
    const backendEvent = {
      seq: 2,
      type: 'APPROVAL_REQUESTED',
      agent: 'approval',
      payload: {
        approval_id: 'appr_456',
        task_key: 'send',
        reason: 'Sends email to 8 recipients.',
        risk: 'HIGH',
      },
      created_at: new Date(startTime + 2000).toISOString(),
    };

    const uiEvent = backendEventToUi(backendEvent, startTime);
    expect(uiEvent.type).toBe('approval');
    expect(uiEvent.text).toContain('Approval required: Sends email to 8 recipients.');
    expect(uiEvent.taskId).toBe('send');
  });

  it('formats verification completed events with pass/fail status', () => {
    const passEvent = {
      seq: 6,
      type: 'VERIFICATION_COMPLETED',
      agent: 'verification',
      payload: { verified: true },
      created_at: new Date(startTime + 15000).toISOString(),
    };
    const failEvent = {
      seq: 7,
      type: 'VERIFICATION_COMPLETED',
      agent: 'verification',
      payload: { verified: false },
      created_at: new Date(startTime + 16000).toISOString(),
    };

    expect(backendEventToUi(passEvent, startTime).type).toBe('verified');
    expect(backendEventToUi(passEvent, startTime).text).toContain('All verification criteria confirmed passed');
    expect(backendEventToUi(failEvent, startTime).text).toContain('Verification encountered failures');
  });

  it('formats mission lifecycle events (start and complete)', () => {
    const startEvent = { seq: 1, type: 'MISSION_STARTED', agent: 'planner' };
    const completeEvent = { seq: 10, type: 'MISSION_COMPLETED', agent: 'planner' };

    expect(backendEventToUi(startEvent, startTime).type).toBe('system');
    expect(backendEventToUi(completeEvent, startTime).type).toBe('complete');
  });
});
