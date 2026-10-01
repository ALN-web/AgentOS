import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// A hook used without importing it only fails when that page renders (the
// Approvals page crashed this way). Catch it statically for every file.
const HOOKS = ['useState', 'useEffect', 'useMemo', 'useCallback', 'useRef', 'useContext', 'useReducer', 'useLayoutEffect'];

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(jsx?|tsx?)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe('React hook imports', () => {
  it('every hook a file calls is imported (or called as React.useX)', () => {
    const missing = [];
    for (const file of sourceFiles(join(process.cwd(), 'src'))) {
      const code = readFileSync(file, 'utf8');
      for (const hook of HOOKS) {
        const called = new RegExp(`(^|[^.\\w])${hook}\\(`).test(code);
        const imported = new RegExp(`import[^;]*\\b${hook}\\b[^;]*from\\s+['"]react['"]`).test(code);
        const definedHere = new RegExp(`(function|const|let)\\s+${hook}\\b`).test(code);
        if (called && !imported && !definedHere) missing.push(`${file.replace(process.cwd(), '')}: ${hook}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
