import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MissionOutcome from './MissionOutcome';

describe('MissionOutcome', () => {
  const dummyMission = {
    id: 'm1',
    goal: 'Test Goal',
    status: 'completed',
    isLive: true,
    metric: { current: 1, target: 1, label: 'Goal' },
    clock: 100,
    tasks: [],
    recoveries: [],
    approvals: [],
    events: [],
    checks: [],
  };

  it('renders real results summary for completed live mission with evidence URL', () => {
    const evidence = [
      { label: 'Event created · Sat 7 PM', url: 'https://cal.com/1', source: 'google_calendar' }
    ];
    
    const html = renderToString(
      <MemoryRouter>
        <MissionOutcome m={dummyMission} evidence={evidence} />
      </MemoryRouter>
    );
    
    expect(html).toContain('Event created · Sat 7 PM');
    expect(html).toContain('https://cal.com/1');
    expect(html).toContain('Open in Calendar');
  });

  it('renders real results summary for completed live mission without URL', () => {
    const evidence = [
      { label: 'Local check passed', url: null, source: 'system' }
    ];
    
    const html = renderToString(
      <MemoryRouter>
        <MissionOutcome m={dummyMission} evidence={evidence} />
      </MemoryRouter>
    );
    
    expect(html).toContain('Local check passed');
    expect(html).not.toContain('href');
  });

  it('does not render real results summary for demo missions', () => {
    const demoMission = { ...dummyMission, isLive: false, demo: true };
    const evidence = [
      { label: 'Simulated event', url: 'https://cal.com/sim', source: 'google_calendar' }
    ];
    
    const html = renderToString(
      <MemoryRouter>
        <MissionOutcome m={demoMission} evidence={evidence} />
      </MemoryRouter>
    );
    
    expect(html).not.toContain('Simulated event');
    expect(html).not.toContain('https://cal.com/sim');
  });

  it('does not expose unexpected sensitive fields', () => {
    const evidence = [
      { label: 'Action performed', url: 'https://example.com', source: 'system', secret_token: 'ya29.abcdef' }
    ];
    
    const html = renderToString(
      <MemoryRouter>
        <MissionOutcome m={dummyMission} evidence={evidence} />
      </MemoryRouter>
    );
    
    expect(html).toContain('Action performed');
    expect(html).not.toContain('ya29.abcdef');
  });
});
