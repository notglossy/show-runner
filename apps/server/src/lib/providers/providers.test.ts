import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Device } from '@/lib/db/schema';
import { env } from '@/lib/env';

import fixture from './__fixtures__/open-meteo-la.json';
import { clearProviderCache, resolveProvider } from './cache';
import { wifiBars } from './device';
import { utcOffsetMinutes } from './time';
import type { DataProvider } from './types';
import {
  cardinal,
  type OpenMeteoResponse,
  openMeteoUrl,
  toWeatherData,
  weatherProvider,
} from './weather';
import { describeWeatherCode } from './weather-codes';

const device = { id: 'dev-1' } as Device;
const ctx = (now = new Date(fixture.current.time * 1000)) => ({
  device,
  config: { ...env(), WEATHER_LOCATION_NAME: 'LA' },
  now,
});

describe('weather', () => {
  it('builds the Open-Meteo URL from config', () => {
    const url = new URL(openMeteoUrl(ctx()));
    expect(url.searchParams.get('latitude')).toBe('34.0522');
    expect(url.searchParams.get('longitude')).toBe('-118.2437');
    expect(url.searchParams.get('temperature_unit')).toBe('fahrenheit');
    expect(url.searchParams.get('timezone')).toBe('America/Los_Angeles');
    expect(url.searchParams.get('timeformat')).toBe('unixtime');
  });

  it('transforms a real response', () => {
    const data = toWeatherData(fixture as OpenMeteoResponse, ctx());
    expect(data.available).toBe(true);
    expect(data.location).toEqual({ name: 'LA', latitude: 34.0522, longitude: -118.2437 });
    expect(data.units).toEqual({ temperature: '°F', windSpeed: 'mph', precipitation: 'in' });
    expect(data.current).toMatchObject({
      temperature: 84,
      feelsLike: 89,
      humidity: 59,
      windDirectionCardinal: 'W',
      isDay: true,
    });
    expect(data.current?.condition).toBe('Clear');
    expect(data.daily).toHaveLength(7);
    expect(data.daily[0]).toMatchObject({
      date: '2026-09-13',
      weekday: 'Sunday',
      weekdayShort: 'Sun',
      high: 85,
      low: 68,
    });
    expect(data.today?.sunrise).toMatch(/^\d{1,2}:\d{2}\s?AM$/);
    expect(data.today?.sunset).toMatch(/^\d{1,2}:\d{2}\s?PM$/);
    expect(data.hourly).toHaveLength(12);
    expect(data.hourly[0]!.iso <= new Date(fixture.current.time * 1000).toISOString()).toBe(true);
    expect(data.hourly[0]?.hour).toMatch(/^\d{1,2}\s?(AM|PM)$/);
  });

  it('maps WMO codes, including unknown and night variants', () => {
    expect(describeWeatherCode(0, false)).toMatchObject({ icon: 'clear', emoji: '🌙' });
    expect(describeWeatherCode(95)).toMatchObject({
      icon: 'thunderstorm',
      condition: 'Thunderstorm',
    });
    expect(describeWeatherCode(1234)).toMatchObject({ icon: 'unknown', condition: 'Unknown' });
    expect(cardinal(258)).toBe('W');
    expect(cardinal(-10)).toBe('N');
    expect(cardinal(359)).toBe('N');
  });

  it('falls back to an unavailable payload when the API fails', async () => {
    clearProviderCache();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    const data = await resolveProvider(weatherProvider, ctx());
    expect(data).toMatchObject({
      available: false,
      error: 'Open-Meteo HTTP 503',
      current: null,
      daily: [],
    });
    vi.unstubAllGlobals();
  });
});

describe('provider cache', () => {
  beforeEach(() => clearProviderCache());

  const makeProvider = (impl: () => Promise<number>, ttlMs = 1000): DataProvider<'n', number> => ({
    key: 'n',
    scope: 'global',
    ttlMs,
    errorRetryMs: 0,
    fetch: impl,
    fallback: () => -1,
  });

  it('caches within the TTL and de-duplicates concurrent fetches', async () => {
    const impl = vi.fn(async () => 42);
    const p = makeProvider(impl);
    const [a, b] = await Promise.all([resolveProvider(p, ctx()), resolveProvider(p, ctx())]);
    expect([a, b, await resolveProvider(p, ctx())]).toEqual([42, 42, 42]);
    expect(impl).toHaveBeenCalledTimes(1);
  });

  it('serves the last good value when a refresh fails, and the fallback when there is none', async () => {
    let fail = false;
    const p = makeProvider(async () => {
      if (fail) throw new Error('down');
      return 7;
    }, 0.001);
    expect(await resolveProvider({ ...p, ttlMs: 1 }, ctx())).toBe(7);
    await new Promise((r) => setTimeout(r, 5));
    fail = true;
    expect(await resolveProvider({ ...p, ttlMs: 1 }, ctx())).toBe(7);

    clearProviderCache();
    expect(await resolveProvider({ ...p, ttlMs: 1 }, ctx())).toBe(-1);
  });

  it('caches per device for device-scoped providers', async () => {
    const impl = vi.fn(async (c: { device: Device }) => c.device.id.length);
    const p: DataProvider<'d', number> = {
      key: 'd',
      scope: 'device',
      ttlMs: 1000,
      fetch: impl,
      fallback: () => 0,
    };
    await resolveProvider(p, { ...ctx(), device: { id: 'a' } as Device });
    await resolveProvider(p, { ...ctx(), device: { id: 'bb' } as Device });
    await resolveProvider(p, { ...ctx(), device: { id: 'a' } as Device });
    expect(impl).toHaveBeenCalledTimes(2);
  });
});

describe('time + device helpers', () => {
  it('computes UTC offsets across DST', () => {
    expect(utcOffsetMinutes(new Date('2026-07-01T12:00:00Z'), 'America/Los_Angeles')).toBe(-420);
    expect(utcOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'America/Los_Angeles')).toBe(-480);
    expect(utcOffsetMinutes(new Date('2026-01-15T12:00:00Z'), 'Asia/Kolkata')).toBe(330);
  });

  it('derives wifi bars from rssi', () => {
    expect([-40, -60, -70, -80, -95].map(wifiBars)).toEqual([4, 3, 2, 1, 0]);
  });
});
