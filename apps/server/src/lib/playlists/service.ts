import { randomUUID } from "node:crypto";
import { asc, eq, inArray } from "drizzle-orm";
import { ApiError, notFound } from "@/lib/api/http";
import type { CreatePlaylistRequest, PlaylistItemInput, UpdatePlaylistRequest } from "@/lib/api/types";
import { getDb, type DbOrTx } from "@/lib/db/client";
import { devices, playlistItems, playlists, screens, type Playlist } from "@/lib/db/schema";
import { publish } from "@/lib/events/bus";
import { playlistItemsFor, type PlaylistItemView } from "./queries";
import { syncDevice, syncPlaylist } from "./scheduler";

export type PlaylistView = Playlist & { items: PlaylistItemView[]; totalSeconds: number };
export type PlaylistSummary = Playlist & { itemCount: number; totalSeconds: number };

const total = (items: { dwellSeconds: number }[]) => items.reduce((s, i) => s + i.dwellSeconds, 0);

export function listPlaylists(): PlaylistSummary[] {
  const db = getDb();
  return db
    .select()
    .from(playlists)
    .orderBy(asc(playlists.name))
    .all()
    .map((p) => {
      const items = playlistItemsFor(p.id, db);
      return { ...p, itemCount: items.length, totalSeconds: total(items) };
    });
}

export function getPlaylistOr404(id: string): PlaylistView {
  const playlist = getDb().select().from(playlists).where(eq(playlists.id, id)).get();
  if (!playlist) throw notFound("Playlist");
  const items = playlistItemsFor(id);
  return { ...playlist, items, totalSeconds: total(items) };
}

function assertScreensExist(items: PlaylistItemInput[], db: DbOrTx) {
  const ids = [...new Set(items.map((i) => i.screenId))];
  if (!ids.length) return;
  const found = new Set(db.select({ id: screens.id }).from(screens).where(inArray(screens.id, ids)).all().map((s) => s.id));
  const issues = items.flatMap((item, i) =>
    found.has(item.screenId) ? [] : [{ path: `items.${i}.screenId`, message: `Screen ${item.screenId} not found` }],
  );
  if (issues.length) throw new ApiError(400, "validation_failed", "Unknown screen in playlist", issues);
}

function replaceItems(playlistId: string, items: PlaylistItemInput[], db: DbOrTx) {
  db.delete(playlistItems).where(eq(playlistItems.playlistId, playlistId)).run();
  if (!items.length) return;
  db.insert(playlistItems)
    .values(items.map((item, position) => ({ id: randomUUID(), playlistId, position, ...item })))
    .run();
}

export function createPlaylist(input: CreatePlaylistRequest): PlaylistView {
  const db = getDb();
  const items = input.items ?? [];
  assertScreensExist(items, db);
  const id = randomUUID();
  db.transaction((tx) => {
    tx.insert(playlists).values({ id, name: input.name }).run();
    replaceItems(id, items, tx);
  });
  return getPlaylistOr404(id);
}

export function updatePlaylist(id: string, input: UpdatePlaylistRequest): PlaylistView {
  const db = getDb();
  getPlaylistOr404(id);
  if (input.items) assertScreensExist(input.items, db);
  db.transaction((tx) => {
    tx.update(playlists)
      .set({ ...(input.name !== undefined ? { name: input.name } : {}), updatedAt: new Date() })
      .where(eq(playlists.id, id))
      .run();
    if (input.items) replaceItems(id, input.items, tx);
  });
  if (input.items) syncPlaylist(id);
  return getPlaylistOr404(id);
}

/** Deleting a playlist unassigns it from devices (they fall back to "no screen"). */
export function deletePlaylist(id: string): void {
  const db = getDb();
  getPlaylistOr404(id);
  const affected = db.select({ id: devices.id }).from(devices).where(eq(devices.playlistId, id)).all();
  db.transaction((tx) => {
    tx.update(devices)
      .set({ assignmentType: "none", playlistId: null, currentScreenId: null, playlistPosition: 0 })
      .where(eq(devices.playlistId, id))
      .run();
    tx.delete(playlists).where(eq(playlists.id, id)).run();
  });
  for (const d of affected) {
    syncDevice(d.id);
    publish(d.id, { type: "navigate", screenId: null });
  }
}
