"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeviceCommandRequest } from "@/lib/api/types";
import { api, ApiClientError } from "@/lib/client/api";
import type { Option } from "./assignment-select";
import { Button, ErrorText, inputBase, inputClass } from "./ui";

export function DeviceCommands({ deviceId, screens, claimed, strict }: { deviceId: string; screens: Option[]; claimed: boolean; strict: boolean }) {
  const router = useRouter();
  const [screenId, setScreenId] = useState(screens[0]?.id ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(command: DeviceCommandRequest) {
    setError(null);
    setMessage(null);
    try {
      const { delivered, queued } = await api<{ delivered: number; queued?: boolean }>(`/api/devices/${deviceId}/commands`, { method: "POST", body: command });
      setMessage(
        queued
          ? "Queued. The display picks it up with its next heartbeat (within about 30 seconds)."
          : delivered > 0
            ? `Sent ${command.type} to ${delivered} connection${delivered === 1 ? "" : "s"}.`
            : "Sent, but the display isn't connected right now.",
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => send({ type: "reload" })}>Reload page</Button>
        <Button onClick={() => send({ type: "refreshData" })}>Refresh data</Button>
      </div>
      {claimed && screens.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <select className={`${inputBase} min-w-48 flex-1`} value={screenId} onChange={(e) => setScreenId(e.target.value)}>
            {screens.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button onClick={() => send({ type: "navigate", screenId })} disabled={!screenId}>
            Show now
          </Button>
        </div>
      )}
      <p className="text-xs text-neutral-500">
        &ldquo;Show now&rdquo; switches the display without changing its assignment; a playlist resumes after one dwell.
      </p>
      <div className="mt-1 flex flex-wrap gap-2 border-t border-neutral-100 pt-3">
        <Button onClick={() => send({ type: "openExitMenu" })}>Open exit menu</Button>
        <Button onClick={() => send({ type: "openSettings" })}>Open Android settings</Button>
        {strict && (
          <Button
            variant="danger"
            onClick={() => window.confirm("Leave strict mode? The app stops being device owner; it stays the Home app.") && send({ type: "exitStrictMode" })}
          >
            Leave strict mode
          </Button>
        )}
      </div>
      <p className="text-xs text-neutral-500">
        Kiosk commands run on the display itself. The exit menu opens without asking for the PIN when sent from here.
      </p>
      {message && <p className="text-sm text-neutral-700">{message}</p>}
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function RenameDevice({ deviceId, name }: { deviceId: string; name: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(name ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api(`/api/devices/${deviceId}`, { method: "PATCH", body: { name: value } });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-1">
      <div className="flex gap-2">
        <input className={inputClass} value={value} onChange={(e) => { setValue(e.target.value); setSaved(false); }} required />
        <Button type="submit" disabled={value === (name ?? "")}>{saved ? "Saved" : "Rename"}</Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export function DeleteDevice({ deviceId, name }: { deviceId: string; name: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    if (!window.confirm(`Delete "${name}"? If the app is still running it will register again and show a new pairing code.`)) return;
    try {
      await api(`/api/devices/${deviceId}`, { method: "DELETE" });
      router.push("/devices");
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }
  return (
    <div className="flex flex-col gap-1">
      <Button variant="danger" onClick={remove}>Delete device</Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}
