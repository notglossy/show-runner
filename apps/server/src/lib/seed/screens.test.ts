import { describe, expect, it } from "vitest";
import { samplePayload } from "@/lib/providers/sample";
import { BUILTIN_SCREENS } from "./screens";

/** Every data path a template references via data-bind / data-bind-attr. */
export function boundPaths(html: string): string[] {
  const paths = [...html.matchAll(/data-bind="([^"]+)"/g)].map((m) => m[1]!);
  for (const m of html.matchAll(/data-bind-attr="([^"]+)"/g)) {
    for (const pair of m[1]!.split(";")) {
      const idx = pair.indexOf(":");
      if (idx > 0) paths.push(pair.slice(idx + 1).trim());
    }
  }
  return paths;
}

function resolve(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((v, k) => (v === null || v === undefined ? undefined : (v as Record<string, unknown>)[k]), data);
}

describe("built-in screens", () => {
  it("includes the clock and clock+weather screens", () => {
    expect(BUILTIN_SCREENS.map((s) => s.id).sort()).toEqual(["builtin-clock", "builtin-clock-weather"]);
  });

  for (const screen of BUILTIN_SCREENS) {
    describe(screen.id, () => {
      const html = screen.html;

      it("is a self-contained body fragment", () => {
        expect(html.trimStart().startsWith("<style>")).toBe(true);
        expect(html).not.toMatch(/<!doctype|<html[\s>]|<head[\s>]|<body[\s>]|<meta[\s>]|<link[\s>]|<title[\s>]/i);
        expect(html).not.toMatch(/https?:\/\//i);
        expect(html).not.toMatch(/<script[^>]*\bsrc=/i);
        expect(html).not.toMatch(/\bimport\s*\(|\bfetch\s*\(|localStorage|setInterval\(/);
        expect((html.match(/<style>/g) ?? []).length).toBe(1);
        expect((html.match(/<script>/g) ?? []).length).toBeLessThanOrEqual(1);
      });

      it("binds only to data paths that exist", () => {
        const data = samplePayload();
        const paths = boundPaths(html);
        expect(paths.length).toBeGreaterThan(0);
        for (const path of paths) expect(resolve(data, path), path).not.toBeUndefined();
      });

      it("has metadata", () => {
        expect(screen.name.length).toBeGreaterThan(0);
        expect(screen.description.length).toBeGreaterThan(0);
        expect(screen.dataRefreshSeconds).toBeGreaterThanOrEqual(5);
      });
    });
  }
});
