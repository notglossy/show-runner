import { randomUUID } from "node:crypto";
import { asc, eq } from "drizzle-orm";
import { conflict, notFound } from "@/lib/api/http";
import type { CreateScreenRequest, UpdateScreenRequest } from "@/lib/api/types";
import { getDb } from "@/lib/db/client";
import { devices, playlistItems, playlists, screens, type Screen } from "@/lib/db/schema";
import { publish } from "@/lib/events/bus";

export type ScreenSummary = Omit<Screen, "html"> & { htmlBytes: number };

export function toScreenSummary({ html, ...rest }: Screen): ScreenSummary {
  return { ...rest, htmlBytes: Buffer.byteLength(html) };
}

export function listScreens(): ScreenSummary[] {
  return getDb().select().from(screens).orderBy(asc(screens.name)).all().map(toScreenSummary);
}

export function findScreen(id: string): Screen | undefined {
  return getDb().select().from(screens).where(eq(screens.id, id)).get();
}

export function getScreenOr404(id: string): Screen {
  const screen = findScreen(id);
  if (!screen) throw notFound("Screen");
  return screen;
}

export function createScreen(input: Omit<CreateScreenRequest, "source"> & { id?: string; source?: Screen["source"] }): Screen {
  return getDb()
    .insert(screens)
    .values({
      id: input.id ?? randomUUID(),
      name: input.name,
      description: input.description ?? "",
      html: input.html,
      dataRefreshSeconds: input.dataRefreshSeconds ?? 60,
      source: input.source ?? "user",
      generationPrompt: input.generationPrompt ?? null,
    })
    .returning()
    .get();
}

/** Updates a screen and reloads every device currently showing it. */
export function updateScreen(id: string, input: UpdateScreenRequest): Screen {
  getScreenOr404(id);
  const screen = getDb().update(screens).set(input).where(eq(screens.id, id)).returning().get();
  const showing = getDb().select({ id: devices.id }).from(devices).where(eq(devices.currentScreenId, id)).all();
  for (const d of showing) publish(d.id, { type: "reload" });
  return screen;
}

/** Refuses (409) while the screen is assigned to a device or used by a playlist. */
export function deleteScreen(id: string): void {
  const db = getDb();
  getScreenOr404(id);
  const assigned = db.select({ id: devices.id, name: devices.name }).from(devices).where(eq(devices.screenId, id)).all();
  const inPlaylists = db
    .selectDistinct({ id: playlists.id, name: playlists.name })
    .from(playlistItems)
    .innerJoin(playlists, eq(playlists.id, playlistItems.playlistId))
    .where(eq(playlistItems.screenId, id))
    .all();
  if (assigned.length || inPlaylists.length) {
    const parts = [
      ...assigned.map((d) => `device "${d.name ?? d.id}"`),
      ...inPlaylists.map((p) => `playlist "${p.name}"`),
    ];
    throw conflict(`Screen is in use by ${parts.join(", ")}`);
  }
  db.delete(screens).where(eq(screens.id, id)).run();
}
