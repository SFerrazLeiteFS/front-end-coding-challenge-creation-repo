import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

describe('starter README', () => {
  it('is the task description followed by a getting started section', () => {
    const readme = read('starter/README.md');

    expect(readme.startsWith(read('docs/task.md'))).toBe(true);
    const gettingStarted = readme.slice(read('docs/task.md').length);
    for (const fact of ['## Getting started', 'pnpm install', 'pnpm dev', 'localhost:3000', 'localhost:4000', 'NEXT_PUBLIC_API_TOKEN', 'Node']) {
      expect(gettingStarted).toContain(fact);
    }
  });
});

describe('mock server README', () => {
  const readme = read('starter/mock-server/README.md');

  it('explains how to work with the mock', () => {
    for (const fact of ['pnpm mock', '4000', 'Bearer', 'viewer', 'MOCK_CHAOS=off', 'MOCK_SEED', '/__mock/reset', 'src/config.ts']) {
      expect(readme).toContain(fact);
    }
  });

  it('keeps the individual settings and the other control endpoints to the source code', () => {
    for (const detail of [
      '_RATE',
      'MOCK_LATENCY_MS',
      'MOCK_FOREIGN_EDIT',
      '/__mock/config',
      '/__mock/next',
      'bump-version',
      'lost',
      'partial',
      '503',
      'conflict',
      'cursor',
    ]) {
      expect(readme.toLowerCase()).not.toContain(detail.toLowerCase());
    }
  });
});

describe('NOTES template', () => {
  it('has the five empty sections', () => {
    const headings = read('starter/NOTES.md')
      .split('\n')
      .filter((line) => line.startsWith('## '));

    expect(headings).toEqual(['## Decisions', '## Trade-offs', '## Left out', '## Next steps', '## AI usage']);
  });
});

describe('review playbook', () => {
  it('has an entry for every next-request behaviour and the version bump', () => {
    const playbook = read('docs/review-playbook.md');

    for (const behavior of ['unavailable', 'internal', 'partial', 'lost-response', 'slow', 'conflict', 'validation']) {
      expect(playbook).toContain(`"behavior": "${behavior}"`);
    }
    expect(playbook).toContain('/__mock/bump-version/');
  });
});
