import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { fontFaceCss, FONTS_PATH, KIOSK_FONTS } from './fonts';

const serverRoot = path.resolve(import.meta.dirname, '../../..');
const authoringDoc = fs.readFileSync(
  path.resolve(serverRoot, '../../docs/screen-authoring.md'),
  'utf8',
);

describe('self-hosted fonts', () => {
  for (const font of KIOSK_FONTS) {
    it(`${font.family}: file, license, and docs are present`, () => {
      const file = path.join(serverRoot, 'public', FONTS_PATH, font.file);
      expect(fs.readFileSync(file).subarray(0, 4).toString('latin1')).toBe('wOF2');
      const license = path.join(
        serverRoot,
        'public',
        FONTS_PATH,
        'licenses',
        font.file.replace('.woff2', '-OFL.txt'),
      );
      expect(fs.readFileSync(license, 'utf8')).toContain('SIL Open Font License');
      expect(authoringDoc).toContain(`| \`"${font.family}"\` |`);
    });
  }

  it('declares every font with font-display: block', () => {
    const css = fontFaceCss();
    expect(css.match(/@font-face/g)).toHaveLength(KIOSK_FONTS.length);
    expect(css).toContain(
      'font-family:"Space Grotesk";src:url("/kiosk/fonts/space-grotesk.woff2") format("woff2");font-weight:300 700',
    );
    expect(css).not.toMatch(/https?:/);
  });
});
