import type { DataProvider } from "./types";

/**
 * Raw server time. The kiosk runtime corrects for device clock skew using `epochMs` and
 * derives the formatted fields (time.hhmm, time.weekday, ...) every second in `timezone`.
 */
export interface TimeData {
  epochMs: number;
  iso: string;
  timezone: string;
  /** Minutes east of UTC at `epochMs` in `timezone` (e.g. -420 for PDT). */
  utcOffsetMinutes: number;
}

export function utcOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

export const timeProvider: DataProvider<"time", TimeData> = {
  key: "time",
  scope: "global",
  ttlMs: 0,
  async fetch({ now, config }) {
    return {
      epochMs: now.getTime(),
      iso: now.toISOString(),
      timezone: config.KIOSK_TIMEZONE,
      utcOffsetMinutes: utcOffsetMinutes(now, config.KIOSK_TIMEZONE),
    };
  },
  fallback(_error, { now, config }) {
    return { epochMs: now.getTime(), iso: now.toISOString(), timezone: config.KIOSK_TIMEZONE, utcOffsetMinutes: 0 };
  },
};
