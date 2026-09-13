"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DeviceAssignment } from "@/lib/api/types";
import { api, ApiClientError } from "@/lib/client/api";
import { inputClass } from "./ui";

export interface Option {
  id: string;
  name: string;
}

const encode = (a: DeviceAssignment) => (a.type === "none" ? "none" : a.type === "screen" ? `screen:${a.screenId}` : `playlist:${a.playlistId}`);

function decode(value: string): DeviceAssignment {
  const [type, id] = value.split(/:(.*)/s);
  if (type === "screen" && id) return { type: "screen", screenId: id };
  if (type === "playlist" && id) return { type: "playlist", playlistId: id };
  return { type: "none" };
}

/** Screen/playlist picker that assigns immediately. */
export function AssignmentSelect({
  deviceId,
  assignment,
  screens,
  playlists,
  disabled,
}: {
  deviceId: string;
  assignment: DeviceAssignment;
  screens: Option[];
  playlists: Option[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(encode(assignment));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function change(next: string) {
    const previous = value;
    setValue(next);
    setPending(true);
    setError(null);
    try {
      await api(`/api/devices/${deviceId}`, { method: "PATCH", body: { assignment: decode(next) } });
      router.refresh();
    } catch (err) {
      setValue(previous);
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <select className={inputClass} value={value} disabled={disabled || pending} onChange={(e) => change(e.target.value)}>
        <option value="none">— Nothing assigned —</option>
        <optgroup label="Screens">
          {screens.map((s) => (
            <option key={s.id} value={`screen:${s.id}`}>
              {s.name}
            </option>
          ))}
        </optgroup>
        {playlists.length > 0 && (
          <optgroup label="Playlists">
            {playlists.map((p) => (
              <option key={p.id} value={`playlist:${p.id}`}>
                ▶ {p.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      {error && <span className="text-xs text-red-700">{error}</span>}
    </div>
  );
}
