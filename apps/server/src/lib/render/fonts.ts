/**
 * Web fonts served from this server (public/kiosk/fonts, Latin subset, SIL OFL; licenses alongside).
 * Declared in every kiosk document; browsers only download a file when a screen uses the family.
 * Keep docs/screen-authoring.md §2 "Fonts" in sync (fonts.test.ts enforces it).
 */
export interface KioskFont {
  family: string;
  file: string;
  /** CSS font-weight descriptor: a single weight or a variable range. */
  weight: string;
  use: string;
}

export const KIOSK_FONTS: readonly KioskFont[] = [
  {
    family: 'Inter',
    file: 'inter.woff2',
    weight: '100 900',
    use: 'Neutral UI sans; excellent numerals',
  },
  {
    family: 'Outfit',
    file: 'outfit.woff2',
    weight: '100 900',
    use: 'Clean geometric sans; friendly large type',
  },
  {
    family: 'Space Grotesk',
    file: 'space-grotesk.woff2',
    weight: '300 700',
    use: 'Techy geometric display',
  },
  { family: 'Nunito', file: 'nunito.woff2', weight: '200 1000', use: 'Rounded, soft and casual' },
  {
    family: 'Oswald',
    file: 'oswald.woff2',
    weight: '200 700',
    use: 'Condensed; fits big numbers in narrow space',
  },
  {
    family: 'Bebas Neue',
    file: 'bebas-neue.woff2',
    weight: '400',
    use: 'Tall condensed all-caps display (single weight)',
  },
  {
    family: 'Playfair Display',
    file: 'playfair-display.woff2',
    weight: '400 900',
    use: 'High-contrast serif display',
  },
  {
    family: 'JetBrains Mono',
    file: 'jetbrains-mono.woff2',
    weight: '100 800',
    use: 'Monospace; dashboards and code-like readouts',
  },
];

export const FONTS_PATH = '/kiosk/fonts';

/** Renders one `@font-face` rule per bundled kiosk font for the document shell. */
export function fontFaceCss(): string {
  return KIOSK_FONTS.map(
    (f) =>
      `@font-face{font-family:"${f.family}";src:url("${FONTS_PATH}/${f.file}") format("woff2");font-weight:${f.weight};font-style:normal;font-display:block}`,
  ).join('\n');
}
