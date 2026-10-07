import { describe, expect, it } from 'vitest';
import {
  APP_METAS,
  normalizeAppId,
  getAppMeta,
  appForTask,
  appForEvent,
} from '../../components/AppIcon';
import { getDataFlowLabel } from './TaskGraph';
import { resolveUsedInputs, explainTask, explainEvent, missionSummary } from '../../engine/selectors';
import { planMission } from '../../agentos/planner';
import { compilePlan } from '../../engine/compile';
import { TEMPLATES, EXAMPLE_GOALS } from '../../data/templates';

describe('Cross-App Data Flow', () => {
  describe('App Icon & Meta Registry', () => {
    it('normalizes app ids cleanly', () => {
      expect(normalizeAppId('Google_Calendar')).toBe('google-calendar');
      expect(normalizeAppId('calendar')).toBe('google-calendar');
      expect(normalizeAppId('GMAIL')).toBe('gmail');
      expect(normalizeAppId('drive')).toBe('google-drive');
      expect(normalizeAppId('google_forms')).toBe('google-forms');
      expect(normalizeAppId('forms')).toBe('google-forms');
      expect(normalizeAppId('slack')).toBe('slack');
      expect(normalizeAppId(null)).toBeNull();
    });

    it('retrieves app metadata for known apps', () => {
      const cal = getAppMeta('google-calendar');
      expect(cal).toBeDefined();
      expect(cal.name).toBe('Google Calendar');
      expect(cal.shortName).toBe('Calendar');

      const gmail = getAppMeta('gmail');
      expect(gmail).toBeDefined();
      expect(gmail.name).toBe('Gmail');

      const drive = getAppMeta('google-drive');
      expect(drive).toBeDefined();
      expect(drive.name).toBe('Google Drive');

      const forms = getAppMeta('google-forms');
      expect(forms).toBeDefined();
      expect(forms.name).toBe('Google Forms');
    });

    it('infers app from task metadata and content', () => {
      expect(appForTask({ app: 'google-calendar' })).toBe('google-calendar');
      expect(appForTask({ type: 'schedule' })).toBe('google-calendar');
      expect(appForTask({ type: 'email' })).toBe('gmail');
      expect(appForTask({ title: 'Find suitable time slot' })).toBe('google-calendar');
      expect(appForTask({ title: 'Draft invitation email to friends' })).toBe('gmail');
      expect(appForTask({ title: 'Build weekly plan in Google Drive' })).toBe('google-drive');
      expect(appForTask({ tool: 'forms.create_form' })).toBe('google-forms');
    });

    it('resolves app for timeline events', () => {
      const tasks = [
        { id: 't1', agent: 'calendar', title: 'Find time slot', startedAt: 10, finishedAt: 20, app: 'google-calendar' },
        { id: 't2', agent: 'gmail', title: 'Send invitation', startedAt: 21, finishedAt: 30, app: 'gmail' },
      ];

      expect(appForEvent({ app: 'gmail' })).toBe('gmail');
      expect(appForEvent({ taskId: 't1' }, tasks)).toBe('google-calendar');
      expect(appForEvent({ agent: 'calendar', t: 15, text: 'Looking up free slots' }, tasks)).toBe('google-calendar');
      expect(appForEvent({ text: 'Scheduled dinner in Google Calendar' })).toBe('google-calendar');
      expect(appForEvent({ text: 'Drafted email invitation in Gmail' })).toBe('gmail');
    });
  });

  describe('Task Graph Data Flow Edge Labels', () => {
    it('generates data flow labels from target inputs', () => {
      const src = { id: 'p2', blueprintStepId: 'cal', app: 'google-calendar', title: 'Create calendar event' };
      const target = {
        id: 'p3',
        app: 'gmail',
        title: 'Draft invitation email',
        inputs: { event_link: 'p2.output.html_link' },
      };

      expect(getDataFlowLabel(src, target)).toBe('event link');
    });

    it('generates cross-app data flow labels from apps and domains', () => {
      const calTask = { id: 'p1', app: 'google-calendar', title: 'Find suitable time slot' };
      const calEventTask = { id: 'p2', app: 'google-calendar', title: 'Create calendar event' };
      const gmailTask = { id: 'p3', app: 'gmail', title: 'Prepare invitation in Gmail' };

      expect(getDataFlowLabel(calTask, calEventTask)).toBe('time slot');
      expect(getDataFlowLabel(calEventTask, gmailTask)).toBe('event link');
    });
  });

  describe('Explainability: Used From Earlier Steps', () => {
    it('resolves used inputs in explainTask with source step and app', () => {
      const mission = {
        goal: 'Organise a birthday dinner for 8 on Saturday',
        clock: 50,
        events: [],
        tasks: [
          {
            id: 'p1',
            title: 'Find suitable time slot',
            app: 'google-calendar',
            agent: 'browser',
            deps: [],
            out: 'Saturday 7:00 PM — 9:30 PM',
          },
          {
            id: 'p2',
            title: 'Create calendar event',
            app: 'google-calendar',
            agent: 'execution',
            deps: ['p1'],
            inputs: { time_slot: 'p1.output' },
            out: { html_link: 'https://calendar.google.com/calendar/event?eid=birthday8dinner' },
          },
          {
            id: 'p3',
            title: 'Prepare invitation in Gmail',
            app: 'gmail',
            agent: 'execution',
            deps: ['p2'],
            inputs: { event_link: 'p2.output.html_link' },
          },
        ],
      };

      const explanation = explainTask(mission, mission.tasks[2]);
      expect(explanation.usedInputs).toBeDefined();
      expect(explanation.usedInputs.length).toBeGreaterThan(0);

      const input = explanation.usedInputs[0];
      expect(input.key).toBe('event_link');
      expect(input.label).toBe('Event link');
      expect(input.fromStepTitle).toBe('Create calendar event');
      expect(input.fromApp).toBe('google-calendar');
      expect(input.value).toContain('https://calendar.google.com');
    });
  });

  describe('Outcome Report: Apps Used Section', () => {
    it('groups completed actions by app in missionSummary', () => {
      const mission = {
        approvals: [],
        recoveries: [],
        events: [{ type: 'verified', agent: 'verification' }],
        tasks: [
          { id: 't1', title: 'Find suitable time slot', status: 'done', app: 'google-calendar', agent: 'browser', finishedAt: 10 },
          { id: 't2', title: 'Create calendar event', status: 'done', app: 'google-calendar', agent: 'execution', finishedAt: 20 },
          { id: 't3', title: 'Send invitation via Gmail', status: 'done', app: 'gmail', agent: 'execution', finishedAt: 30 },
          { id: 't4', title: 'Verify', status: 'done', app: null, agent: 'verification', finishedAt: 40 },
        ],
      };

      const summary = missionSummary(mission);
      expect(summary.appsUsed).toBeDefined();
      expect(summary.appsUsed.length).toBe(2);

      const calApp = summary.appsUsed.find((a) => a.id === 'google-calendar');
      expect(calApp).toBeDefined();
      expect(calApp.doneCount).toBe(2);
      expect(calApp.actions).toContain('Find suitable time slot');
      expect(calApp.actions).toContain('Create calendar event');

      const gmailApp = summary.appsUsed.find((a) => a.id === 'gmail');
      expect(gmailApp).toBeDefined();
      expect(gmailApp.doneCount).toBe(1);
      expect(gmailApp.actions).toContain('Send invitation via Gmail');
    });
  });

  describe('Birthday Dinner Mission Cross-App Plan', () => {
    it('spans Google Calendar and Gmail with inputs data flow', () => {
      const plan = planMission('Organise a birthday dinner for 8 on Saturday');
      expect(plan.tasks.length).toBeGreaterThanOrEqual(4);

      const apps = plan.tasks.map((t) => t.app).filter(Boolean);
      expect(apps).toContain('google-calendar');
      expect(apps).toContain('gmail');

      const calTask = plan.tasks.find((t) => t.app === 'google-calendar' && t.type === 'schedule');
      expect(calTask).toBeDefined();

      const gmailTask = plan.tasks.find((t) => t.app === 'gmail');
      expect(gmailTask).toBeDefined();
      expect(gmailTask.inputs).toBeDefined();
      expect(gmailTask.inputs.event_link).toBeDefined();
    });

    it('has cross-app templates registered in Launcher suggestions', () => {
      expect(EXAMPLE_GOALS[0]).toContain('Birthday dinner');
      expect(EXAMPLE_GOALS[1]).toContain('Weekly planner');

      const birthdayTemplate = TEMPLATES.find((t) => t.id === 'plans-os');
      expect(birthdayTemplate).toBeDefined();
      expect(birthdayTemplate.category).toBe('Cross-App');
      expect(birthdayTemplate.apps).toContain('google-calendar');
      expect(birthdayTemplate.apps).toContain('gmail');

      const weekTemplate = TEMPLATES.find((t) => t.id === 'week-os');
      expect(weekTemplate).toBeDefined();
      expect(weekTemplate.category).toBe('Cross-App');
      expect(weekTemplate.apps).toContain('google-calendar');
      expect(weekTemplate.apps).toContain('google-drive');
    });
  });
});
