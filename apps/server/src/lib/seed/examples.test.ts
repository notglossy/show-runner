import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { validateTemplate } from '@/lib/ai/validate';

import { allExampleFolders, builtinExamples, EXAMPLES_DIR } from './examples';

// `pnpm --filter @showrunner/server examples` sets this to rewrite the built-in examples' screen.html from
// the seed templates (like a snapshot update). Other examples, screenshots and READMEs are edited by hand.
const UPDATE = process.env.UPDATE_EXAMPLES === '1';

describe('built-in examples', () => {
  for (const { screen, folder } of builtinExamples()) {
    it(`${folder}/screen.html matches the ${screen.name} seed template`, () => {
      const dir = path.join(EXAMPLES_DIR, folder);
      const file = path.join(dir, 'screen.html');
      if (UPDATE) {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, `${screen.html}\n`);
      }
      // Out of date? Run `pnpm --filter @showrunner/server examples`.
      expect(readFileSync(file, 'utf8')).toBe(`${screen.html}\n`);
    });
  }
});

describe('every example', () => {
  for (const folder of allExampleFolders()) {
    const dir = path.join(EXAMPLES_DIR, folder);

    it(`${folder} has screen.html, README.md and screenshot.png`, () => {
      for (const file of ['screen.html', 'README.md', 'screenshot.png']) {
        expect(existsSync(path.join(dir, file)), `${folder}/${file}`).toBe(true);
      }
    });

    it(`${folder}/screen.html follows the screen authoring rules`, () => {
      expect(validateTemplate(readFileSync(path.join(dir, 'screen.html'), 'utf8'))).toEqual([]);
    });
  }
});
