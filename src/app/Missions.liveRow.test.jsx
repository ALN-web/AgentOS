import { describe, expect, it } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MissionRow from '../components/MissionRow';
import { liveRow } from './Missions';

describe('live missions in the Missions list', () => {
  it('renders an API mission summary without crashing', () => {
    const summary = {
      id: 'abc', goal: 'Coffee meeting tomorrow at 10 am', mode: 'live', status: 'completed',
      metric: { label: 'Success criteria met', current: 1, target: 1 }, task_count: 5,
      created_at: '2026-10-02T13:19:37Z', updated_at: '2026-10-02T13:25:00Z',
    };
    const html = renderToString(<MemoryRouter><MissionRow m={liveRow(summary)} now={Date.now()} /></MemoryRouter>);
    expect(html).toContain('Coffee meeting tomorrow at 10 am');
    expect(html).toContain('/app/live/missions/abc');
  });
});
