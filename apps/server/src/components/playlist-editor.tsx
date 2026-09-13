"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PlaylistView } from "@/lib/playlists/service";
import { api, ApiClientError } from "@/lib/client/api";
import { duration } from "@/lib/client/format";
import type { Option } from "./assignment-select";
import { Badge, Button, Card, Empty, ErrorText, Field, inputBase, inputClass } from "./ui";

interface Item {
  key: number;
  screenId: string;
  dwellSeconds: number;
}

let nextKey = 1;
const toItems = (items: { screenId: string; dwellSeconds: number }[]): Item[] =>
  items.map((i) => ({ key: nextKey++, screenId: i.screenId, dwellSeconds: i.dwellSeconds }));

export function PlaylistEditor({
  playlist,
  screens,
  devices,
}: {
  playlist: Pick<PlaylistView, "id" | "name" | "items"> | null;
  screens: Option[];
  devices: { id: string; name: string | null }[];
}) {
  const router = useRouter();
  const [name, setName] = useState(playlist?.name ?? "");
  const [items, setItems] = useState<Item[]>(() => toItems(playlist?.items ?? []));
  const [savedJson, setSavedJson] = useState(() => JSON.stringify({ name: playlist?.name ?? "", items: playlist?.items.map(({ screenId, dwellSeconds }) => ({ screenId, dwellSeconds })) ?? [] }));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const body = { name, items: items.map(({ screenId, dwellSeconds }) => ({ screenId, dwellSeconds })) };
  const dirty = JSON.stringify(body) !== savedJson;
  const total = items.reduce((s, i) => s + (Number.isFinite(i.dwellSeconds) ? i.dwellSeconds : 0), 0);

  const update = (key: number, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const move = (index: number, delta: number) =>
    setItems((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item!);
      return next;
    });

  async function save() {
    setPending(true);
    setError(null);
    try {
      if (playlist) {
        await api(`/api/playlists/${playlist.id}`, { method: "PATCH", body });
        setSavedJson(JSON.stringify(body));
        router.refresh();
      } else {
        const { playlist: created } = await api<{ playlist: PlaylistView }>("/api/playlists", { method: "POST", body });
        router.replace(`/playlists/${created.id}`);
      }
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!playlist || !window.confirm(`Delete playlist "${playlist.name}"? Devices using it will show nothing until reassigned.`)) return;
    try {
      await api(`/api/playlists/${playlist.id}`, { method: "DELETE" });
      router.push("/playlists");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Name" className="min-w-64 flex-1">
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </Field>
          {dirty && <Badge tone="amber">Unsaved</Badge>}
          <Button variant="primary" onClick={save} disabled={pending || !dirty || !name.trim()}>
            {pending ? "Saving…" : playlist ? "Save" : "Create playlist"}
          </Button>
        </div>
        <ErrorText>{error}</ErrorText>

        <Card title={`Screens · ${items.length} · ${duration(total)} per loop`}>
          {items.length === 0 ? (
            <Empty>No screens yet. Add one below.</Empty>
          ) : (
            <ol className="flex flex-col gap-2">
              {items.map((item, index) => (
                <li key={item.key} className="flex flex-wrap items-center gap-2">
                  <span className="w-6 text-right text-sm text-neutral-500">{index + 1}.</span>
                  <select className={`${inputBase} min-w-48 flex-1`} value={item.screenId} onChange={(e) => update(item.key, { screenId: e.target.value })}>
                    {screens.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-sm text-neutral-600">
                    <input
                      className={`${inputBase} w-20`}
                      type="number"
                      min={5}
                      max={86400}
                      value={Number.isFinite(item.dwellSeconds) ? item.dwellSeconds : ""}
                      onChange={(e) => update(item.key, { dwellSeconds: e.target.valueAsNumber })}
                    />
                    s
                  </label>
                  <Button size="sm" variant="ghost" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move up">
                    ↑
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => move(index, 1)} disabled={index === items.length - 1} aria-label="Move down">
                    ↓
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setItems((list) => list.filter((i) => i.key !== item.key))} aria-label="Remove">
                    ✕
                  </Button>
                </li>
              ))}
            </ol>
          )}
          <div className="mt-4">
            <Button
              size="sm"
              onClick={() => setItems((list) => [...list, { key: nextKey++, screenId: screens[0]?.id ?? "", dwellSeconds: 30 }])}
              disabled={screens.length === 0}
            >
              + Add screen
            </Button>
          </div>
        </Card>
      </div>

      {playlist && (
        <div className="flex flex-col gap-4">
          <Card title="Assigned to">
            {devices.length === 0 ? (
              <p className="text-sm text-neutral-500">No devices. Assign it from a device&apos;s page.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-sm">
                {devices.map((d) => (
                  <li key={d.id}>
                    <Link className="underline underline-offset-2" href={`/devices/${d.id}`}>
                      {d.name ?? d.id}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-3 text-xs text-neutral-500">Saving changes restarts rotation on these devices from the current position.</p>
          </Card>
          <div className="flex justify-end">
            <Button variant="danger" size="sm" onClick={remove}>
              Delete playlist
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
