import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { builtinExamples, EXAMPLES_DIR } from './examples';

// `pnpm --filter @showrunner/server examples` sets this to rewrite examples/*/screen.html from the seed
// templates (like a snapshot update). Screenshots and READMEs are maintained by hand.
const UPDATE = process.env.UPDATE_EXAMPLES === '1';

describe('examples/', () => {
  for (const { screen, folder } of builtinExamples()) {
    const dir = path.join(EXAMPLES_DIR, folder);

    it(`${folder}/screen.html matches the ${screen.name} seed template`, () => {
      const file = path.join(dir, 'screen.html');
      if (UPDATE) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, `${screen.html}\n`);
      }
      // Out of date? Run `pnpm --filter @showrunner/server examples`.
      expect(readFileSync(file, 'utf8')).toBe(`${screen.html}\n`);
    });

    it(`${folder} has a README and a screenshot`, () => {
      expect(existsSync(path.join(dir, 'README.md'))).toBe(true);
      expect(existsSync(path.join(dir, 'screenshot.png'))).toBe(true);
    });
  }
});
