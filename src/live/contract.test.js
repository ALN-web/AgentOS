// The MissionPlan contract between the frontend planner and the backend.
//
// backend/tests/fixtures/plans/*.json are plans produced by the real frontend
// planner. The backend tests post them to its API; this test fails if the
// planner's output drifts from them. After an intentional planner change,
// regenerate with:  UPDATE_CONTRACT=1 npx vitest run src/live/contract.test.js

import { describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { planMission } from '../agentos/planner';

const DIR = join(process.cwd(), 'backend', 'tests', 'fixtures', 'plans');

export const CONTRACT_GOALS = {
  hero: 'Get 100 registrations for our college hackathon',
  hackathon: 'Organize a hackathon for 100 students in my college.',
  internships: 'Find 20 suitable internship opportunities.',
  launch: 'Prepare and launch our new product.',
  research: 'Research the market for AI customer support platforms and create a report.',
};

describe('MissionPlan contract fixtures', () => {
  for (const [name, goal] of Object.entries(CONTRACT_GOALS)) {
    it(`${name} plan matches the backend fixture`, () => {
      const plan = JSON.parse(JSON.stringify(planMission(goal)));
      const file = join(DIR, `${name}.json`);
      if (process.env.UPDATE_CONTRACT === '1' || !existsSync(file)) {
        mkdirSync(DIR, { recursive: true });
        writeFileSync(file, `${JSON.stringify({ goal, plan }, null, 2)}\n`);
      }
      const fixture = JSON.parse(readFileSync(file, 'utf8'));
      expect(fixture.goal).toBe(goal);
      expect(plan).toEqual(fixture.plan);
    });
  }
});
