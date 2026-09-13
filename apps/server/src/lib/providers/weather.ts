import { z } from "zod";
import type { DataProvider, ProviderContext } from "./types";
import { describeWeatherCode, type WeatherIcon } from "./weather-codes";

export interface WeatherCondition {
  weatherCode: number;
  condition: string;
  icon: WeatherIcon;
  emoji: string;
}

export interface WeatherData {
  available: boolean;
  /** Set when the last fetch failed and no earlier data exists. */
  error: string | null;
  fetchedAt: string | null;
  /** Where the forecast is for. `name` is the label set in dashboard settings (may be null). */
  location: { name: string | null; latitude: number; longitude: number };
  units: { temperature: "°F" | "°C"; windSpeed: "mph" | "km/h"; precipitation: "in" | "mm" };
  current:
    | (WeatherCondition & {
        temperature: number;
        feelsLike: number;
        humidity: number;
        windSpeed: number;
        windDirection: number;
        windDirectionCardinal: string;
        precipitation: number;
        isDay: boolean;
      })
    | null;
  today:
    | (WeatherCondition & {
        high: number;
        low: number;
        precipitationChance: number | null;
        uvIndexMax: number | null;
        sunrise: string;
        sunset: string;
        sunriseIso: string;
        sunsetIso: string;
      })
    | null;
  daily: Array<
    WeatherCondition & {
      date: string;
      weekday: string;
      weekdayShort: string;
      high: number;
      low: number;
      precipitationChance: number | null;
    }
  >;
  hourly: Array<
    WeatherCondition & {
      iso: string;
      hour: string;
      temperature: number;
      precipitationChance: number | null;
      isDay: boolean;
    }
  >;
}

const nums = z.array(z.number());
const nullableNums = z.array(z.number().nullable());

const OpenMeteoResponse = z.object({
  current: z.object({
    time: z.number(),
    temperature_2m: z.number(),
    apparent_temperature: z.number(),
    relative_humidity_2m: z.number(),
    is_day: z.number(),
    precipitation: z.number(),
    weather_code: z.number(),
    wind_speed_10m: z.number(),
    wind_direction_10m: z.number(),
  }),
  hourly: z.object({
    time: nums,
    temperature_2m: nums,
    precipitation_probability: nullableNums,
    weather_code: nums,
    is_day: nums,
  }),
  daily: z.object({
    time: nums,
    weather_code: nums,
    temperature_2m_max: nums,
    temperature_2m_min: nums,
    precipitation_probability_max: nullableNums,
    sunrise: nums,
    sunset: nums,
    uv_index_max: nullableNums,
  }),
});

export type OpenMeteoResponse = z.infer<typeof OpenMeteoResponse>;

const CARDINALS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const cardinal = (degrees: number) => CARDINALS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8]!;

function locationFor(config: ProviderContext["config"]): WeatherData["location"] {
  return { name: config.WEATHER_LOCATION_NAME, latitude: config.WEATHER_LAT, longitude: config.WEATHER_LON };
}

function unitsFor(system: "imperial" | "metric"): WeatherData["units"] {
  return system === "imperial"
    ? { temperature: "°F", windSpeed: "mph", precipitation: "in" }
    : { temperature: "°C", windSpeed: "km/h", precipitation: "mm" };
}

export function openMeteoUrl({ config }: Pick<ProviderContext, "config">): string {
  const imperial = config.WEATHER_UNITS === "imperial";
  const params = new URLSearchParams({
    latitude: String(config.WEATHER_LAT),
    longitude: String(config.WEATHER_LON),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max",
    temperature_unit: imperial ? "fahrenheit" : "celsius",
    wind_speed_unit: imperial ? "mph" : "kmh",
    precipitation_unit: imperial ? "inch" : "mm",
    timezone: config.KIOSK_TIMEZONE,
    forecast_days: "7",
    timeformat: "unixtime",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

/** Pure transform from an Open-Meteo response to the kiosk.data.weather shape. */
export function toWeatherData(raw: OpenMeteoResponse, ctx: Pick<ProviderContext, "config" | "now">): WeatherData {
  const tz = ctx.config.KIOSK_TIMEZONE;
  const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts });
  const clock = fmt({ hour: "numeric", minute: "2-digit" });
  const hourOnly = fmt({ hour: "numeric" });
  const weekdayLong = fmt({ weekday: "long" });
  const weekdayShort = fmt({ weekday: "short" });
  const isoDate = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const at = (unixSeconds: number) => new Date(unixSeconds * 1000);
  const round = Math.round;
  const pct = (v: number | null | undefined) => (v === null || v === undefined ? null : round(v));

  const c = raw.current;
  const currentIsDay = c.is_day === 1;
  const d = raw.daily;

  const daily = d.time.map((t, i) => ({
    date: isoDate.format(at(t)),
    weekday: weekdayLong.format(at(t)),
    weekdayShort: weekdayShort.format(at(t)),
    high: round(d.temperature_2m_max[i]!),
    low: round(d.temperature_2m_min[i]!),
    precipitationChance: pct(d.precipitation_probability_max[i]),
    ...describeWeatherCode(d.weather_code[i]!, true),
  }));

  const hourStart = Math.floor(ctx.now.getTime() / 3_600_000) * 3600;
  const h = raw.hourly;
  const firstHour = Math.max(0, h.time.findIndex((t) => t >= hourStart));
  const hourly = h.time.slice(firstHour, firstHour + 12).map((t, offset) => {
    const i = firstHour + offset;
    const isDay = h.is_day[i] === 1;
    return {
      iso: at(t).toISOString(),
      hour: hourOnly.format(at(t)),
      temperature: round(h.temperature_2m[i]!),
      precipitationChance: pct(h.precipitation_probability[i]),
      isDay,
      ...describeWeatherCode(h.weather_code[i]!, isDay),
    };
  });

  return {
    available: true,
    error: null,
    fetchedAt: ctx.now.toISOString(),
    location: locationFor(ctx.config),
    units: unitsFor(ctx.config.WEATHER_UNITS),
    current: {
      temperature: round(c.temperature_2m),
      feelsLike: round(c.apparent_temperature),
      humidity: round(c.relative_humidity_2m),
      windSpeed: round(c.wind_speed_10m),
      windDirection: round(c.wind_direction_10m),
      windDirectionCardinal: cardinal(c.wind_direction_10m),
      precipitation: c.precipitation,
      isDay: currentIsDay,
      ...describeWeatherCode(c.weather_code, currentIsDay),
    },
    today: daily[0]
      ? {
          ...daily[0],
          uvIndexMax: d.uv_index_max[0] === null || d.uv_index_max[0] === undefined ? null : round(d.uv_index_max[0]),
          sunrise: clock.format(at(d.sunrise[0]!)),
          sunset: clock.format(at(d.sunset[0]!)),
          sunriseIso: at(d.sunrise[0]!).toISOString(),
          sunsetIso: at(d.sunset[0]!).toISOString(),
        }
      : null,
    daily,
    hourly,
  };
}

export const weatherProvider: DataProvider<"weather", WeatherData> = {
  key: "weather",
  scope: "global",
  ttlMs: 10 * 60_000,
  errorRetryMs: 60_000,
  async fetch(ctx) {
    const res = await fetch(openMeteoUrl(ctx), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
    if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
    return toWeatherData(OpenMeteoResponse.parse(await res.json()), ctx);
  },
  fallback(error, { config }) {
    return {
      available: false,
      error: error instanceof Error ? error.message : String(error),
      fetchedAt: null,
      location: locationFor(config),
      units: unitsFor(config.WEATHER_UNITS),
      current: null,
      today: null,
      daily: [],
      hourly: [],
    };
  },
};
