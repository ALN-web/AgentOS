// Guards the public Demo Mode: it must stay self-contained, with no network
// calls, no environment-dependent behaviour and no third-party assets. Live
// Mode code, when it arrives, lives under src/live/ and is excluded here.

import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(process.cwd(), 'src');
const EXCLUDED_DIRS = new Set(['live']);

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return EXCLUDED_DIRS.has(name) ? [] : sourceFiles(path);
    return /\.(jsx?|css)$/.test(name) && !/\.test\.jsx?$/.test(name) ? [path] : [];
  });
}

const FORBIDDEN = [
  { name: 'fetch()', re: /\bfetch\s*\(/ },
  { name: 'axios', re: /\baxios\b/ },
  { name: 'XMLHttpRequest', re: /\bXMLHttpRequest\b/ },
  { name: 'WebSocket', re: /\bnew\s+WebSocket\b/ },
  { name: 'EventSource', re: /\bnew\s+EventSource\b/ },
  { name: 'sendBeacon', re: /\bsendBeacon\b/ },
  { name: 'import.meta.env', re: /import\.meta\.env/ },
  { name: 'remote import', re: /import\s*\(?\s*['"]https?:/ },
];

describe('Demo Mode stays self-contained', () => {
  const files = sourceFiles(ROOT);

  it('finds the source files', () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it('makes no network calls and reads no environment variables', () => {
    const hits = [];
    for (const file of files) {
      const text = readFileSync(file, 'utf8');
      for (const { name, re } of FORBIDDEN) if (re.test(text)) hits.push(`${file.replace(ROOT, 'src')}: ${name}`);
    }
    expect(hits).toEqual([]);
  });

  it('loads no third-party fonts, scripts or styles from index.html', () => {
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
    expect(html).not.toMatch(/<(script|link)[^>]+(src|href)=["']https?:/i);
  });
});
