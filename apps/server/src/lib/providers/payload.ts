import type { Device, Screen } from '@/lib/db/schema';
import { effectiveConfig } from '@/lib/settings/service';
import { resolveProvider } from './cache';
import { providers, type ProviderData } from './registry';
import type { DataProvider } from './types';

/** The JSON document exposed to templates as `window.kiosk.data` (before runtime-derived time fields). */
export type KioskDataPayload = ProviderData & {
  generatedAt: string;
  screen: { id: string; name: string } | null;
};

/** Resolves every provider for a device into the `window.kiosk.data` document. */
export async function buildDataPayload(
  device: Device,
  screen: Pick<Screen, 'id' | 'name'> | null,
): Promise<KioskDataPayload> {
  const ctx = { device, config: effectiveConfig(), now: new Date() };
  const values = await Promise.all(
    providers.map(
      async (p) => [p.key, await resolveProvider(p as DataProvider<string, unknown>, ctx)] as const,
    ),
  );
  return {
    ...(Object.fromEntries(values) as ProviderData),
    generatedAt: ctx.now.toISOString(),
    screen: screen ? { id: screen.id, name: screen.name } : null,
  };
}
