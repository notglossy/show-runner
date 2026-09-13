import { eq } from "drizzle-orm";
import type { UpdateSettingsRequest } from "@/lib/api/types";
import { getDb } from "@/lib/db/client";
import { devices, settings } from "@/lib/db/schema";
import { env, type Env } from "@/lib/env";
import type { ProviderConfig } from "@/lib/providers/types";
import { publish } from "@/lib/events/bus";
import { clearProviderCache } from "@/lib/providers/cache";

/** Settings the owner can change in the dashboard. Env vars supply the defaults. */
export interface KioskSettings {
  weatherLatitude: number;
  weatherLongitude: number;
  weatherUnits: "imperial" | "metric";
  weatherLocationName: string | null;
  timezone: string;
}

export type SettingsOverrides = Partial<KioskSettings>;

const OVERRIDES_KEY = "overrides";

export function defaultSettings(config: Env = env()): KioskSettings {
  return {
    weatherLatitude: config.WEATHER_LAT,
    weatherLongitude: config.WEATHER_LON,
    weatherUnits: config.WEATHER_UNITS,
    weatherLocationName: null,
    timezone: config.KIOSK_TIMEZONE,
  };
}

export function getOverrides(): SettingsOverrides {
  const row = getDb().select().from(settings).where(eq(settings.key, OVERRIDES_KEY)).get();
  return (row?.value as SettingsOverrides | undefined) ?? {};
}

export function getSettings(): { effective: KioskSettings; defaults: KioskSettings; overrides: SettingsOverrides } {
  const defaults = defaultSettings();
  const overrides = getOverrides();
  return { effective: { ...defaults, ...overrides }, defaults, overrides };
}

/** Env config with dashboard overrides applied, as seen by data providers. */
export function effectiveConfig(): ProviderConfig {
  const { effective } = getSettings();
  return {
    ...env(),
    WEATHER_LAT: effective.weatherLatitude,
    WEATHER_LON: effective.weatherLongitude,
    WEATHER_UNITS: effective.weatherUnits,
    KIOSK_TIMEZONE: effective.timezone,
    WEATHER_LOCATION_NAME: effective.weatherLocationName,
  };
}

/** Applies a patch (null clears an override), drops cached provider data, and refreshes every device. */
export function updateSettings(patch: UpdateSettingsRequest) {
  const next: Record<string, unknown> = { ...getOverrides() };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete next[key];
    else if (value !== undefined) next[key] = value;
  }
  getDb()
    .insert(settings)
    .values({ key: OVERRIDES_KEY, value: next })
    .onConflictDoUpdate({ target: settings.key, set: { value: next, updatedAt: new Date() } })
    .run();
  clearProviderCache();
  // The runtime re-derives time fields from the refreshed payload's timezone, so no reload is needed.
  for (const d of getDb().select({ id: devices.id }).from(devices).all()) publish(d.id, { type: "refreshData" });
  return getSettings();
}
