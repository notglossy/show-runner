import type { Device } from "@/lib/db/schema";
import type { Env } from "@/lib/env";

export interface ProviderContext {
  device: Device;
  config: Env;
  now: Date;
}

/**
 * A source of live data for kiosk.data. The value of `fetch()` appears in the payload under `key`.
 * To add one: create a file in this folder and add it to `registry.ts`, then document its fields
 * in docs/screen-authoring.md.
 */
export interface DataProvider<K extends string = string, T = unknown> {
  readonly key: K;
  /** "global" results are shared by all devices; "device" results are cached per device. */
  readonly scope: "global" | "device";
  /** How long a successful result is reused. 0 = compute on every request. */
  readonly ttlMs: number;
  /** How long to wait before retrying after a failure. */
  readonly errorRetryMs?: number;
  /** Throw on failure; the cache serves the last good value (or `fallback`) instead. */
  fetch(ctx: ProviderContext): Promise<T>;
  /** Value used when fetch fails and no previous good value exists. */
  fallback(error: unknown, ctx: ProviderContext): T;
}
