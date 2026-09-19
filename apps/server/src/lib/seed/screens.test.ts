import { describe, expect, it } from 'vitest';
import { validateTemplate } from '@/lib/ai/validate';
import { BUILTIN_SCREENS } from './screens';

describe('built-in screens', () => {
  it('includes the clock and clock+weather screens', () => {
    expect(BUILTIN_SCREENS.map((s) => s.id).sort()).toEqual([
      'builtin-clock',
      'builtin-clock-weather',
    ]);
  });

  for (const screen of BUILTIN_SCREENS) {
    describe(screen.id, () => {
      const html = screen.html;

      it('passes the template rules (fragment, no external resources, known data paths)', () => {
        expect(validateTemplate(html)).toEqual([]);
      });

      it('has metadata', () => {
        expect(screen.name.length).toBeGreaterThan(0);
        expect(screen.description.length).toBeGreaterThan(0);
        expect(screen.dataRefreshSeconds).toBeGreaterThanOrEqual(5);
      });
    });
  }
});
