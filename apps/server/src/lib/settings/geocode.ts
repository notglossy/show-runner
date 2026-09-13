import { z } from "zod";

export interface GeocodeResult {
  /** "Los Angeles, California, United States" */
  label: string;
  latitude: number;
  longitude: number;
  timezone: string | null;
}

const Response = z.object({
  results: z
    .array(
      z.object({
        name: z.string(),
        latitude: z.number(),
        longitude: z.number(),
        timezone: z.string().optional(),
        admin1: z.string().optional(),
        country: z.string().optional(),
      }),
    )
    .optional(),
});

/** Place search via Open-Meteo's free geocoding API (no key). */
export async function geocode(query: string): Promise<GeocodeResult[]> {
  const params = new URLSearchParams({ name: query, count: "8", language: "en", format: "json" });
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`, {
    signal: AbortSignal.timeout(8000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Geocoding HTTP ${res.status}`);
  const { results = [] } = Response.parse(await res.json());
  return results.map((r) => ({
    label: [r.name, r.admin1, r.country].filter(Boolean).join(", "),
    latitude: Math.round(r.latitude * 10_000) / 10_000,
    longitude: Math.round(r.longitude * 10_000) / 10_000,
    timezone: r.timezone ?? null,
  }));
}
