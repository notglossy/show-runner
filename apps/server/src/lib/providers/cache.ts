import type { DataProvider, ProviderContext } from "./types";

interface Entry {
  value: unknown;
  /** Epoch ms after which the value is refetched. */
  expiresAt: number;
  /** false when `value` is a fallback rather than a real result. */
  good: boolean;
  inflight?: Promise<unknown>;
}

const globalForCache = globalThis as unknown as { __showrunnerProviderCache?: Map<string, Entry> };
const entries = (globalForCache.__showrunnerProviderCache ??= new Map());

export function clearProviderCache() {
  entries.clear();
}

const cacheKey = (provider: DataProvider, ctx: ProviderContext) =>
  provider.scope === "device" ? `${provider.key}:${ctx.device.id}` : provider.key;

/** Resolves a provider's value with TTL caching, in-flight de-duplication, and stale-on-error. */
export async function resolveProvider<T>(provider: DataProvider<string, T>, ctx: ProviderContext): Promise<T> {
  if (provider.ttlMs === 0) return (await fetchOrFallback(provider, ctx, undefined)).value as T;

  const key = cacheKey(provider, ctx);
  const entry = entries.get(key);
  if (entry && !entry.inflight && entry.expiresAt > Date.now()) return entry.value as T;
  if (entry?.inflight) return entry.inflight as Promise<T>;

  const inflight = fetchOrFallback(provider, ctx, entry).then((next) => {
    entries.set(key, next);
    return next.value as T;
  });
  entries.set(key, { ...(entry ?? { value: undefined, expiresAt: 0, good: false }), inflight });
  return inflight;
}

async function fetchOrFallback<T>(
  provider: DataProvider<string, T>,
  ctx: ProviderContext,
  previous: Entry | undefined,
): Promise<Entry> {
  try {
    const value = await provider.fetch(ctx);
    return { value, expiresAt: Date.now() + provider.ttlMs, good: true };
  } catch (error) {
    console.warn(`[provider:${provider.key}] fetch failed:`, error instanceof Error ? error.message : error);
    const expiresAt = Date.now() + (provider.errorRetryMs ?? 60_000);
    if (previous?.good) return { value: previous.value, expiresAt, good: true };
    return { value: provider.fallback(error, ctx), expiresAt, good: false };
  }
}
