import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { devices, type Device } from '@/lib/db/schema';
import { publish } from '@/lib/events/bus';
import { playlistItemsFor } from './queries';

/**
 * Rotates playlist-assigned devices: one timer per device, fired after the current item's dwell.
 * State (position, current screen) lives in the devices table so a restart resumes where it was.
 */
const globalForScheduler = globalThis as unknown as {
  __showrunnerTimers?: Map<string, NodeJS.Timeout>;
};
const timers = (globalForScheduler.__showrunnerTimers ??= new Map());

function clearTimer(deviceId: string) {
  const t = timers.get(deviceId);
  if (t) clearTimeout(t);
  timers.delete(deviceId);
}

function loadDevice(deviceId: string): Device | undefined {
  return getDb().select().from(devices).where(eq(devices.id, deviceId)).get();
}

/**
 * Brings a device's rotation state in line with its playlist and (re)arms its timer.
 * With `holdCurrentScreen`, a manually chosen screen is left in place for one full dwell first.
 */
export function syncDevice(deviceId: string, opts: { holdCurrentScreen?: boolean } = {}): void {
  clearTimer(deviceId);
  const device = loadDevice(deviceId);
  if (!device || device.assignmentType !== 'playlist' || !device.playlistId) return;

  const items = playlistItemsFor(device.playlistId);
  const position = items.length ? device.playlistPosition % items.length : 0;
  const expected = items[position]?.screenId ?? null;
  const holding = opts.holdCurrentScreen === true && device.currentScreenId !== expected;
  if (!holding && (expected !== device.currentScreenId || position !== device.playlistPosition)) {
    getDb()
      .update(devices)
      .set({ currentScreenId: expected, playlistPosition: position })
      .where(eq(devices.id, deviceId))
      .run();
    publish(deviceId, { type: 'navigate', screenId: expected });
  }
  if (!items.length || (items.length < 2 && !holding)) return;

  const dwellMs = items[position]!.dwellSeconds * 1000;
  const timer = setTimeout(() => advance(deviceId), dwellMs);
  timer.unref?.();
  timers.set(deviceId, timer);
}

function advance(deviceId: string): void {
  timers.delete(deviceId);
  const device = loadDevice(deviceId);
  if (!device || device.assignmentType !== 'playlist' || !device.playlistId) return;
  const items = playlistItemsFor(device.playlistId);
  if (items.length) {
    const position = (device.playlistPosition + 1) % items.length;
    getDb()
      .update(devices)
      .set({ playlistPosition: position })
      .where(eq(devices.id, deviceId))
      .run();
  }
  syncDevice(deviceId);
}

export function syncPlaylist(playlistId: string): void {
  const assigned = getDb()
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.playlistId, playlistId))
    .all();
  for (const d of assigned) syncDevice(d.id);
}

/** Called once at server start. */
export function startScheduler(): void {
  const assigned = getDb()
    .select({ id: devices.id })
    .from(devices)
    .where(eq(devices.assignmentType, 'playlist'))
    .all();
  for (const d of assigned) syncDevice(d.id);
}

export function stopScheduler(): void {
  for (const id of [...timers.keys()]) clearTimer(id);
}

export const activeRotations = () => timers.size;
