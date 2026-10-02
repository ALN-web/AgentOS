import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { COLD_START_MESSAGE } from './useBackendStatus';
import BackendStatus from './BackendStatus';

describe('Cold start resilience and retry behavior (#102)', () => {
  it('defines the required judge-friendly cold start message', () => {
    expect(COLD_START_MESSAGE).toBe('Connecting to the live server… (first visit can take up to a minute)');
  });

  it('renders cold start connecting message and never raw error when backend is slow or failing', () => {
    const htmlChecking = renderToString(
      <BackendStatus
        statusOverride={{
          configured: true,
          status: 'checking',
          message: COLD_START_MESSAGE,
        }}
      />
    );

    expect(htmlChecking).toContain('Connecting to the live server… (first visit can take up to a minute)');
    expect(htmlChecking).toContain('Connecting…');
    expect(htmlChecking).not.toContain('Unreachable');
    expect(htmlChecking).not.toContain('Could not reach the backend');
  });

  it('suppresses raw technical errors and displays friendly message if status is unreachable/waking', () => {
    const htmlUnreachable = renderToString(
      <BackendStatus
        statusOverride={{
          configured: true,
          status: 'unreachable',
          message: COLD_START_MESSAGE,
          error: 'ECONNREFUSED 127.0.0.1:8000',
        }}
      />
    );

    expect(htmlUnreachable).toContain('Connecting to the live server… (first visit can take up to a minute)');
    expect(htmlUnreachable).not.toContain('ECONNREFUSED');
  });

  it('renders connected information when backend health succeeds', () => {
    const htmlConnected = renderToString(
      <BackendStatus
        statusOverride={{
          configured: true,
          status: 'connected',
          version: '1.0.0',
          database: 'sqlite',
          liveMode: { available: true },
        }}
      />
    );

    expect(htmlConnected).toContain('Connected');
    expect(htmlConnected).toContain('Live Mode available');
    expect(htmlConnected).not.toContain('Connecting to the live server');
  });
});
