import { samplePayload } from '@/lib/providers/sample';

/** Every data path a template references via data-bind / data-bind-attr. */
export function boundPaths(html: string): string[] {
  const paths = [...html.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]!);
  for (const m of html.matchAll(/data-bind-attr="([^"]+)"/g)) {
    for (const pair of m[1]!.split(';')) {
      const idx = pair.indexOf(':');
      if (idx > 0) paths.push(pair.slice(idx + 1).trim());
    }
  }
  return paths;
}

function resolvePath(data: unknown, path: string): unknown {
  return path
    .split('.')
    .reduce<unknown>(
      (v, k) => (v === null || v === undefined ? undefined : (v as Record<string, unknown>)[k]),
      data,
    );
}

/**
 * Checks a template against the mechanical rules in docs/screen-authoring.md.
 * Returns human-readable problems (empty = OK). Used on AI output and by the seed screen tests.
 */
export function validateTemplate(html: string): string[] {
  const problems: string[] = [];
  const trimmed = html.trim();
  if (!trimmed) return ['The template is empty.'];
  if (!trimmed.startsWith('<style'))
    problems.push('The fragment must start with a <style> element.');
  if (/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<meta[\s>]|<link[\s>]|<title[\s>]/i.test(html)) {
    problems.push(
      'Remove document-level tags (<!doctype>, <html>, <head>, <body>, <meta>, <link>, <title>); output a body fragment only.',
    );
  }
  if (/https?:\/\//i.test(html))
    problems.push(
      'Remove every http:// or https:// URL; screens must not load external resources.',
    );
  if (/<script[^>]*\bsrc\s*=/i.test(html))
    problems.push('Do not use <script src>; inline the script.');
  if (/\bfetch\s*\(|\bXMLHttpRequest\b|\bimport\s*\(|\blocalStorage\b/.test(html)) {
    problems.push(
      'Do not use fetch, XMLHttpRequest, dynamic import, or localStorage; use kiosk.data instead.',
    );
  }
  if (/\bsetInterval\s*\(/.test(html))
    problems.push("Do not use setInterval; use kiosk.on('tick', ...) for per-second updates.");
  const styles = (html.match(/<style[\s>]/gi) ?? []).length;
  if (styles !== 1) problems.push(`Use exactly one <style> element (found ${styles}).`);
  const scripts = (html.match(/<script[\s>]/gi) ?? []).length;
  if (scripts > 1) problems.push(`Use at most one <script> element (found ${scripts}).`);
  if ((html.match(/<script[\s>]/gi) ?? []).length !== (html.match(/<\/script>/gi) ?? []).length) {
    problems.push('A <script> element is not closed (the output may be truncated).');
  }
  const data = samplePayload();
  const unknown = [
    ...new Set(boundPaths(html).filter((path) => resolvePath(data, path) === undefined)),
  ];
  if (unknown.length) {
    problems.push(
      `These data-bind paths don't exist in kiosk.data (see section 6): ${unknown.join(', ')}.`,
    );
  }
  return problems;
}
