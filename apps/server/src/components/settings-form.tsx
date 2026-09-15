"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { UpdateSettingsRequest } from "@/lib/api/types";
import type { KioskDataPayload } from "@/lib/providers/payload";
import type { GeocodeResult } from "@/lib/settings/geocode";
import type { KioskSettings, SettingsOverrides } from "@/lib/settings/service";
import { api, ApiClientError } from "@/lib/client/api";
import { Button, Card, ErrorText, Field, inputBase, inputClass } from "./ui";

type Form = {
  weatherLatitude: string;
  weatherLongitude: string;
  weatherUnits: "imperial" | "metric";
  weatherLocationName: string;
  timezone: string;
};

const toForm = (s: KioskSettings): Form => ({
  weatherLatitude: String(s.weatherLatitude),
  weatherLongitude: String(s.weatherLongitude),
  weatherUnits: s.weatherUnits,
  weatherLocationName: s.weatherLocationName ?? "",
  timezone: s.timezone,
});

export function SettingsForm({ effective, defaults, overrides }: { effective: KioskSettings; defaults: KioskSettings; overrides: SettingsOverrides }) {
  const router = useRouter();
  const [form, setForm] = useState<Form>(() => toForm(effective));
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeocodeResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [check, setCheck] = useState<string | null>(null);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const set = (patch: Partial<Form>) => {
    setForm((f) => ({ ...f, ...patch }));
    setNotice(null);
  };

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const { results } = await api<{ results: GeocodeResult[] }>(`/api/settings/geocode?${new URLSearchParams({ q: query })}`);
      setResults(results);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  function pick(result: GeocodeResult) {
    set({
      weatherLatitude: String(result.latitude),
      weatherLongitude: String(result.longitude),
      weatherLocationName: result.label,
      ...(result.timezone ? { timezone: result.timezone } : {}),
    });
    setResults(null);
    setNotice(`Filled in ${result.label}${result.timezone ? ` (timezone ${result.timezone})` : ""}. Save to apply.`);
  }

  async function patch(body: UpdateSettingsRequest, message: string) {
    setPending(true);
    setError(null);
    try {
      const next = await api<{ effective: KioskSettings }>("/api/settings", { method: "PATCH", body });
      setForm(toForm(next.effective));
      setNotice(message);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    const values: KioskSettings = {
      weatherLatitude: Number(form.weatherLatitude),
      weatherLongitude: Number(form.weatherLongitude),
      weatherUnits: form.weatherUnits,
      weatherLocationName: form.weatherLocationName.trim() || null,
      timezone: form.timezone,
    };
    // A value equal to its environment default is stored as "no override", so it keeps following the env.
    const body = Object.fromEntries(
      (Object.keys(values) as (keyof KioskSettings)[]).map((key) => [key, values[key] === defaults[key] ? null : values[key]]),
    ) as UpdateSettingsRequest;
    void patch(body, "Saved. Connected displays are refreshing their data.");
  }

  async function checkWeather() {
    setCheck("Checking…");
    try {
      const data = await api<KioskDataPayload>("/api/preview/data");
      const w = data.weather;
      setCheck(
        w.available && w.current
          ? `${w.location.name ?? `${w.location.latitude}, ${w.location.longitude}`}: ${w.current.temperature}${w.units.temperature}, ${w.current.condition}. Local time ${new Date(data.time.epochMs).toLocaleTimeString("en-US", { timeZone: data.time.timezone, hour: "numeric", minute: "2-digit" })} (${data.time.timezone}).`
          : `Weather unavailable: ${w.error ?? "unknown error"}`,
      );
    } catch (err) {
      setCheck(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  const overridden = (key: keyof KioskSettings) => key in overrides;
  const resetButton = (key: keyof KioskSettings, label: string) =>
    overridden(key) ? (
      <button type="button" className="text-xs text-neutral-500 underline underline-offset-2" onClick={() => patch({ [key]: null }, `${label} reset to the default.`)}>
        Reset to default ({String(defaults[key] ?? "none")})
      </button>
    ) : (
      <span className="text-xs text-neutral-400">Default from environment</span>
    );

  // Open-Meteo data is CC BY 4.0: credit it wherever its weather or place data is shown.
  const openMeteoAttribution = (
    <p className="text-xs text-neutral-500">
      <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-neutral-900">
        Weather data by Open-Meteo.com
      </a>
    </p>
  );

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <form onSubmit={save} className="flex flex-col gap-6 lg:col-span-2">
        <Card title="Weather location">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input className={`${inputBase} flex-1`} placeholder="Search for a place, e.g. Pasadena" value={query} onChange={(e) => setQuery(e.target.value)} />
                <Button onClick={search} disabled={query.trim().length < 2}>
                  Search
                </Button>
              </div>
              {results && (
                <ul className="divide-y divide-neutral-100 rounded-md border border-neutral-200 text-sm">
                  {results.length === 0 && <li className="p-2 text-neutral-500">No matches.</li>}
                  {results.map((r) => (
                    <li key={`${r.latitude},${r.longitude}`}>
                      <button type="button" onClick={() => pick(r)} className="flex w-full justify-between gap-3 p-2 text-left hover:bg-neutral-50">
                        <span>{r.label}</span>
                        <span className="text-xs text-neutral-500">
                          {r.latitude}, {r.longitude}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Latitude" hint={resetButton("weatherLatitude", "Latitude")}>
                <input className={inputClass} type="number" step="any" min={-90} max={90} value={form.weatherLatitude} onChange={(e) => set({ weatherLatitude: e.target.value })} required />
              </Field>
              <Field label="Longitude" hint={resetButton("weatherLongitude", "Longitude")}>
                <input className={inputClass} type="number" step="any" min={-180} max={180} value={form.weatherLongitude} onChange={(e) => set({ weatherLongitude: e.target.value })} required />
              </Field>
              <Field label="Location name (shown on screens as weather.location.name)" hint={resetButton("weatherLocationName", "Location name")} className="sm:col-span-2">
                <input className={inputClass} value={form.weatherLocationName} maxLength={100} onChange={(e) => set({ weatherLocationName: e.target.value })} />
              </Field>
            </div>
            {openMeteoAttribution}
          </div>
        </Card>

        <Card title="Units and time">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Units" hint={resetButton("weatherUnits", "Units")}>
              <select className={inputClass} value={form.weatherUnits} onChange={(e) => set({ weatherUnits: e.target.value as Form["weatherUnits"] })}>
                <option value="imperial">Imperial (°F, mph, in)</option>
                <option value="metric">Metric (°C, km/h, mm)</option>
              </select>
            </Field>
            <Field label="Timezone" hint={resetButton("timezone", "Timezone")}>
              <input className={inputClass} list="timezones" value={form.timezone} onChange={(e) => set({ timezone: e.target.value })} required />
              <datalist id="timezones">
                {timezones.map((tz) => (
                  <option key={tz} value={tz} />
                ))}
              </datalist>
            </Field>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={pending}>
            {pending ? "Saving…" : "Save settings"}
          </Button>
          {notice && <span className="text-sm text-neutral-600">{notice}</span>}
        </div>
        <ErrorText>{error}</ErrorText>
      </form>

      <div className="flex flex-col gap-4">
        <Card title="Check">
          <p className="mb-3 text-sm text-neutral-600">Fetch current weather and time with the saved settings.</p>
          <Button onClick={checkWeather}>Check weather now</Button>
          {check && <p className="mt-3 text-sm text-neutral-800">{check}</p>}
          <div className="mt-3">{openMeteoAttribution}</div>
        </Card>
        <Card title="About these settings">
          <p className="text-sm text-neutral-600">
            Values here override the server&apos;s environment variables (WEATHER_LAT, WEATHER_LON, WEATHER_UNITS, KIOSK_TIMEZONE). Weather is
            cached for 10 minutes; saving clears the cache and tells every connected display to refresh.
          </p>
        </Card>
      </div>
    </div>
  );
}
