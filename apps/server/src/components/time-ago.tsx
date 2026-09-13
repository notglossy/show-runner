"use client";

import { useSyncExternalStore } from "react";
import { timeAgo } from "@/lib/client/format";

// One shared 5-second clock for every <TimeAgo>.
const TICK_MS = 5000;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  timer ??= setInterval(() => listeners.forEach((l) => l()), TICK_MS);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => Math.floor(Date.now() / TICK_MS) * TICK_MS;
const getServerSnapshot = () => null;

/** Relative time that updates itself; shows the absolute time as a tooltip. */
export function TimeAgo({ iso }: { iso: string | null }) {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!iso) return <span>never</span>;
  return (
    <time dateTime={iso} title={now === null ? undefined : new Date(iso).toLocaleString()}>
      {now === null ? "" : timeAgo(iso, now)}
    </time>
  );
}
