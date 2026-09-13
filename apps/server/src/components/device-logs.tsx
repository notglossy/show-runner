"use client";

import { useCallback, useEffect, useState } from "react";
import type { DeviceLog } from "@/lib/db/schema";
import { api, ApiClientError } from "@/lib/client/api";
import { Badge, Button, Empty, ErrorText } from "./ui";

type LogRow = Omit<DeviceLog, "createdAt"> & { createdAt: string };
const PAGE = 50;

export function DeviceLogs({ deviceId, screenNames }: { deviceId: string; screenNames: Record<string, string> }) {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [level, setLevel] = useState<"all" | "error" | "warn" | "info">("all");
  const [hasMore, setHasMore] = useState(false);
  const [live, setLive] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const fetchPage = useCallback(
    async (before?: number) => {
      const params = new URLSearchParams({ limit: String(PAGE) });
      if (before) params.set("before", String(before));
      return (await api<{ logs: LogRow[] }>(`/api/devices/${deviceId}/logs?${params}`)).logs;
    },
    [deviceId],
  );

  const loadLatest = useCallback(async () => {
    try {
      const page = await fetchPage();
      setLogs((current) => {
        // Keep older pages the user already loaded; replace the newest page.
        const oldestNew = page.at(-1)?.id ?? Infinity;
        return [...page, ...current.filter((l) => l.id < oldestNew)];
      });
      setHasMore((more) => more || page.length === PAGE);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setLoaded(true);
    }
  }, [fetchPage]);

  useEffect(() => {
    let cancelled = false;
    const tick = () => {
      if (!cancelled) void loadLatest();
    };
    const first = setTimeout(tick, 0);
    const id = live ? setInterval(tick, 10_000) : undefined;
    return () => {
      cancelled = true;
      clearTimeout(first);
      if (id) clearInterval(id);
    };
  }, [loadLatest, live]);

  async function loadOlder() {
    const oldest = logs.at(-1)?.id;
    if (!oldest) return;
    const page = await fetchPage(oldest);
    setLogs((current) => [...current, ...page]);
    setHasMore(page.length === PAGE);
  }

  const visible = level === "all" ? logs : logs.filter((l) => l.level === level);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {(["all", "error", "warn", "info"] as const).map((l) => (
          <Button key={l} size="sm" variant={level === l ? "primary" : "secondary"} onClick={() => setLevel(l)}>
            {l}
          </Button>
        ))}
        <label className="ml-auto flex items-center gap-1.5 text-xs text-neutral-600">
          <input type="checkbox" checked={live} onChange={(e) => setLive(e.target.checked)} /> Auto-refresh
        </label>
      </div>
      <ErrorText>{error}</ErrorText>
      {loaded && visible.length === 0 ? (
        <Empty>No log entries. JavaScript errors from screens on this display will appear here.</Empty>
      ) : (
        <ul className="divide-y divide-neutral-100 text-sm">
          {visible.map((log) => {
            const ctx = log.context;
            const where = [ctx.source && `${ctx.source.split("/").pop()}${ctx.line ? `:${ctx.line}` : ""}`, ctx.screenId && (screenNames[ctx.screenId] ?? ctx.screenId)]
              .filter(Boolean)
              .join(" · ");
            return (
              <li key={log.id} className="py-2">
                <button type="button" className="flex w-full items-start gap-3 text-left" onClick={() => setExpanded(expanded === log.id ? null : log.id)}>
                  <span className="w-36 shrink-0 font-mono text-xs text-neutral-500">{new Date(log.createdAt).toLocaleString()}</span>
                  <Badge tone={log.level === "error" ? "red" : log.level === "warn" ? "amber" : "gray"}>{log.level}</Badge>
                  <span className="min-w-0 flex-1 break-words text-neutral-800">{log.message}</span>
                  {where && <span className="shrink-0 text-xs text-neutral-500">{where}</span>}
                </button>
                {expanded === log.id && (
                  <pre className="mt-2 overflow-x-auto rounded bg-neutral-50 p-2 text-xs text-neutral-700">
                    {JSON.stringify(ctx, null, 2)}
                  </pre>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hasMore && (
        <Button size="sm" onClick={loadOlder} className="self-center">
          Load older
        </Button>
      )}
    </div>
  );
}
