import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import * as S from '../api/schemas';
import type * as T from '../api/types';
import { extractHtml } from './extract';

type Extends<A, B> = [A] extends [B] ? true : false;
type InSync<Schema extends z.ZodType, I> =
  Extends<z.output<Schema>, I> extends true
    ? Extends<I, z.input<Schema>> extends true
      ? true
      : false
    : false;
const ok = <X extends true>(): X | void => undefined;
ok<InSync<typeof S.GenerateScreenRequestSchema, T.GenerateScreenRequest>>();

const FENCE = '```';

describe('GenerateScreenRequestSchema', () => {
  const parse = (v: unknown) => S.GenerateScreenRequestSchema.safeParse(v);
  it('accepts minimal and full requests, trimming strings', () => {
    expect(parse({ instruction: 'A big clock' }).success).toBe(true);
    const full = S.GenerateScreenRequestSchema.parse({
      instruction: '  make it bigger ',
      currentHtml: '<style></style><p>x</p>',
      model: ' google/gemini-3.8-flash ',
      previewErrors: ['TypeError: x'],
    });
    expect(full).toEqual({
      instruction: 'make it bigger',
      currentHtml: '<style></style><p>x</p>',
      model: 'google/gemini-3.8-flash',
      previewErrors: ['TypeError: x'],
    });
    expect(parse({ instruction: 'x', currentHtml: null }).success).toBe(true);
  });
  it('rejects bad input', () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ instruction: '   ' }).success).toBe(false);
    expect(parse({ instruction: 'x'.repeat(4001) }).success).toBe(false);
    expect(parse({ instruction: 'x', currentHtml: 'y'.repeat(512001) }).success).toBe(false);
    expect(parse({ instruction: 'x', model: '' }).success).toBe(false);
    expect(parse({ instruction: 'x', model: 'm'.repeat(201) }).success).toBe(false);
    expect(parse({ instruction: 'x', previewErrors: Array(21).fill('e') }).success).toBe(false);
    expect(parse({ instruction: 'x', previewErrors: [''] }).success).toBe(false);
    expect(parse({ instruction: 'x', previewErrors: ['e'.repeat(1001)] }).success).toBe(false);
  });
});

describe('extractHtml', () => {
  it('returns the content of an html fenced block, trimmed', () => {
    expect(
      extractHtml(
        `Here you go:\n${FENCE}html\n<style>a{}</style>\n<main></main>\n${FENCE}\nEnjoy!`,
      ),
    ).toBe('<style>a{}</style>\n<main></main>');
  });
  it('accepts HTML/Html info strings and extra words after the language', () => {
    expect(extractHtml(`${FENCE}HTML\n<p>1</p>\n${FENCE}`)).toBe('<p>1</p>');
    expect(extractHtml(`${FENCE}html title="screen"\n<p>2</p>\n${FENCE}`)).toBe('<p>2</p>');
  });
  it('uses the last html block when there are several', () => {
    expect(
      extractHtml(`${FENCE}html\n<p>old</p>\n${FENCE}\ntext\n${FENCE}html\n<p>new</p>\n${FENCE}`),
    ).toBe('<p>new</p>');
  });
  it('prefers html blocks over other fences, and falls back to the last fence of any language', () => {
    expect(
      extractHtml(
        `${FENCE}css\na{}\n${FENCE}\n${FENCE}html\n<p>h</p>\n${FENCE}\n${FENCE}js\nx()\n${FENCE}`,
      ),
    ).toBe('<p>h</p>');
    expect(extractHtml(`${FENCE}\n<p>plain</p>\n${FENCE}`)).toBe('<p>plain</p>');
    expect(extractHtml(`${FENCE}xml\n<p>a</p>\n${FENCE}\n${FENCE}\n<p>b</p>\n${FENCE}`)).toBe(
      '<p>b</p>',
    );
  });
  it('returns everything after an unterminated html fence (truncated reply)', () => {
    expect(extractHtml(`${FENCE}html\n<style>a{}</style>\n<main>cut off`)).toBe(
      '<style>a{}</style>\n<main>cut off',
    );
  });
  it('accepts a bare fragment with no fences', () => {
    expect(extractHtml('  \n<style>b{}</style><p>bare</p>\n')).toBe(
      '<style>b{}</style><p>bare</p>',
    );
  });
  it('normalises CRLF', () => {
    expect(extractHtml(`${FENCE}html\r\n<p>x</p>\r\n<p>y</p>\r\n${FENCE}`)).toBe(
      '<p>x</p>\n<p>y</p>',
    );
  });
  it('returns null when there is no HTML', () => {
    expect(extractHtml("Sorry, I can't help with that.")).toBeNull();
    expect(extractHtml('')).toBeNull();
    expect(extractHtml(`${FENCE}html\n\n${FENCE}`)).toBeNull();
  });
});
