import type { Env } from "@/lib/env";
import fixture from "./__fixtures__/open-meteo-la.json";
import type { KioskDataPayload } from "./payload";
import { toWeatherData, type OpenMeteoResponse } from "./weather";

/** Time fields as the kiosk runtime derives them in the browser (see public/kiosk/runtime.js). */
export interface DerivedTimeFields {
  hour24: string;
  hour12: string;
  minute: string;
  second: string;
  ampm: "AM" | "PM";
  hhmm: string;
  hhmm24: string;
  weekday: string;
  weekdayShort: string;
  month: string;
  monthShort: string;
  day: string;
  year: string;
  date: string;
  dateShort: string;
  isoDate: string;
  greeting: string;
}

export type BrowserKioskData = Omit<KioskDataPayload, "time"> & { time: KioskDataPayload["time"] & DerivedTimeFields };

/**
 * A realistic kiosk.data payload (as templates see it in the browser) for previews and tests,
 * built from a recorded Open-Meteo response for Los Angeles.
 */
export function samplePayload(): BrowserKioskData {
  const now = new Date(fixture.current.time * 1000);
  const config = {
    KIOSK_TIMEZONE: "America/Los_Angeles",
    WEATHER_UNITS: "imperial",
    WEATHER_LAT: 34.0522,
    WEATHER_LON: -118.2437,
  } as Env;
  return {
    generatedAt: now.toISOString(),
    screen: { id: "sample", name: "Sample" },
    time: {
      epochMs: now.getTime(),
      iso: now.toISOString(),
      timezone: "America/Los_Angeles",
      utcOffsetMinutes: -420,
      hour24: "14",
      hour12: "2",
      minute: "15",
      second: "00",
      ampm: "PM",
      hhmm: "2:15",
      hhmm24: "14:15",
      weekday: "Sunday",
      weekdayShort: "Sun",
      month: "September",
      monthShort: "Sep",
      day: "13",
      year: "2026",
      date: "Sunday, September 13",
      dateShort: "Sun, Sep 13",
      isoDate: "2026-09-13",
      greeting: "Good afternoon",
    },
    weather: toWeatherData(fixture as OpenMeteoResponse, { config, now }),
    device: {
      id: "00000000-0000-4000-8000-000000000000",
      name: "Living Room",
      claimed: true,
      model: "Echo_Show_8",
      appVersion: "0.1.0",
      screenWidth: 1280,
      screenHeight: 800,
      battery: null,
      wifi: { rssi: -52, ssid: "home", bars: 4 },
      lastSeenAt: now.toISOString(),
    },
  } satisfies BrowserKioskData;
}

