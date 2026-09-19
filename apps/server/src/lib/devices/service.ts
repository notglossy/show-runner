import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm';
import { ApiError, notFound } from '@/lib/api/http';
import type {
  ClaimDeviceRequest,
  DeviceAssignment,
  DeviceCommandRequest,
  DeviceLogRequest,
  DeviceLogsQuery,
  HeartbeatRequest,
  NativeCommandType,
  RegisterDeviceRequest,
  UpdateDeviceRequest,
} from '@/lib/api/types';
import { randomPairingCode, randomToken, sha256 } from '@/lib/auth/crypto';
import { getDb } from '@/lib/db/client';
import {
  deviceLogs,
  devices,
  playlists,
  type Device,
  type DeviceLog,
  type Screen,
} from '@/lib/db/schema';
import { connectionCount, publish } from '@/lib/events/bus';
import { playlistItemsFor } from '@/lib/playlists/queries';
import { syncDevice } from '@/lib/playlists/scheduler';
import { findScreen } from '@/lib/screens/service';

/** How often devices heartbeat; tripled, it defines the online window. */
export const HEARTBEAT_INTERVAL_SECONDS = 30;
/** A device counts as online if its last heartbeat is newer than this. */
export const ONLINE_WINDOW_MS = 3 * HEARTBEAT_INTERVAL_SECONDS * 1000;
/** Screen assigned automatically when a device is claimed. */
export const DEFAULT_SCREEN_ID = 'builtin-clock';
/** Caps stored log lines per device; older lines are pruned on insert. */
export const MAX_LOGS_PER_DEVICE = 1000;
/** How long the previous token keeps working after a re-registration. */
export const PREVIOUS_TOKEN_GRACE_MS = 10 * 60_000;

/** Device as returned by admin APIs (never includes the token hash). */
export interface DeviceView {
  id: string;
  name: string | null;
  claimed: boolean;
  claimedAt: string | null;
  pairingCode: string | null;
  model: string;
  androidVersion: string;
  appVersion: string;
  screenWidth: number;
  screenHeight: number;
  assignment: DeviceAssignment;
  currentScreenId: string | null;
  playlistPosition: number;
  online: boolean;
  /** Open SSE connections from the device itself. */
  connected: boolean;
  lastSeenAt: string | null;
  lastIp: string | null;
  status: Device['status'];
  registeredAt: string;
  createdAt: string;
  updatedAt: string;
}

/** Reads the device row's assignment columns back into a `DeviceAssignment`. */
export function assignmentOf(d: Device): DeviceAssignment {
  if (d.assignmentType === 'screen' && d.screenId) return { type: 'screen', screenId: d.screenId };
  if (d.assignmentType === 'playlist' && d.playlistId)
    return { type: 'playlist', playlistId: d.playlistId };
  return { type: 'none' };
}

/** Shapes a device row for admin APIs, deriving its `online` and `connected` flags. */
export function toDeviceView(d: Device, now = Date.now()): DeviceView {
  return {
    id: d.id,
    name: d.name,
    claimed: d.claimedAt !== null,
    claimedAt: d.claimedAt?.toISOString() ?? null,
    pairingCode: d.pairingCode,
    model: d.model,
    androidVersion: d.androidVersion,
    appVersion: d.appVersion,
    screenWidth: d.screenWidth,
    screenHeight: d.screenHeight,
    assignment: assignmentOf(d),
    currentScreenId: d.currentScreenId,
    playlistPosition: d.playlistPosition,
    online: d.lastSeenAt !== null && now - d.lastSeenAt.getTime() < ONLINE_WINDOW_MS,
    connected: connectionCount(d.id, 'device') > 0,
    lastSeenAt: d.lastSeenAt?.toISOString() ?? null,
    lastIp: d.lastIp,
    status: d.status,
    registeredAt: d.registeredAt.toISOString(),
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

/** Lists every device, most recently seen first. */
export function listDevices(): Device[] {
  return getDb().select().from(devices).orderBy(desc(devices.lastSeenAt)).all();
}

/** Looks up a device by id, returning undefined when it does not exist. */
export function findDevice(id: string): Device | undefined {
  return getDb().select().from(devices).where(eq(devices.id, id)).get();
}

/** Loads a device by id, throwing 404 when it does not exist. */
export function getDeviceOr404(id: string): Device {
  const device = findDevice(id);
  if (!device) throw notFound('Device');
  return device;
}

function uniquePairingCode(): string {
  const db = getDb();
  for (let attempt = 0; attempt < 20; attempt++) {
    const code = randomPairingCode();
    if (!db.select({ id: devices.id }).from(devices).where(eq(devices.pairingCode, code)).get())
      return code;
  }
  throw new Error('Could not allocate a unique pairing code');
}

/**
 * Creates or refreshes a device record and issues a fresh token (the previous token stops working).
 * Unclaimed devices keep their pairing code across re-registrations.
 */
export function registerDevice(
  input: RegisterDeviceRequest,
  ip: string | null,
): { device: Device; token: string } {
  const db = getDb();
  const token = randomToken();
  const now = new Date();
  const meta = {
    model: input.model,
    androidVersion: input.androidVersion,
    appVersion: input.appVersion,
    screenWidth: input.screenWidth,
    screenHeight: input.screenHeight,
    tokenHash: sha256(token),
    registeredAt: now,
    lastIp: ip,
  };
  const existing = findDevice(input.deviceId);
  let device: Device;
  if (!existing) {
    device = db
      .insert(devices)
      .values({ id: input.deviceId, pairingCode: uniquePairingCode(), ...meta })
      .returning()
      .get();
  } else {
    const pairingCode = existing.claimedAt ? null : (existing.pairingCode ?? uniquePairingCode());
    device = db
      .update(devices)
      .set({
        ...meta,
        pairingCode,
        previousTokenHash: existing.tokenHash,
        previousTokenExpiresAt: new Date(now.getTime() + PREVIOUS_TOKEN_GRACE_MS),
      })
      .where(eq(devices.id, existing.id))
      .returning()
      .get();
  }
  return { device, token };
}

/** Stores the heartbeat status snapshot and marks the device seen now. */
export function recordHeartbeat(
  device: Device,
  input: HeartbeatRequest,
  ip: string | null,
): Device {
  const status: Device['status'] = {
    battery: input.battery ?? null,
    wifi: input.wifi ?? null,
    currentUrl: input.currentUrl ?? null,
    uptimeSeconds: input.uptimeSeconds ?? null,
    appVersion: device.appVersion,
    kioskMode: input.kioskMode ?? null,
    isDefaultHome: input.isDefaultHome ?? null,
  };
  return getDb()
    .update(devices)
    .set({ status, lastSeenAt: new Date(), lastIp: ip })
    .where(eq(devices.id, device.id))
    .returning()
    .get();
}

/** Claims an unclaimed device by pairing code and assigns the default screen. */
export function claimDevice(input: ClaimDeviceRequest): Device {
  const db = getDb();
  const device = db
    .select()
    .from(devices)
    .where(and(eq(devices.pairingCode, input.pairingCode), isNull(devices.claimedAt)))
    .get();
  if (!device) throw notFound('Unclaimed device with that pairing code');
  db.update(devices)
    .set({ name: input.name, claimedAt: new Date(), pairingCode: null })
    .where(eq(devices.id, device.id))
    .run();
  if (device.assignmentType === 'none' && findScreen(DEFAULT_SCREEN_ID)) {
    return applyAssignment(device.id, { type: 'screen', screenId: DEFAULT_SCREEN_ID });
  }
  publish(device.id, { type: 'reload' });
  return getDeviceOr404(device.id);
}

function requireClaimed(device: Device) {
  if (!device.claimedAt) throw new ApiError(409, 'conflict', 'Device must be claimed first');
}

/** Renames a device and/or applies a new assignment. */
export function updateDevice(id: string, input: UpdateDeviceRequest): Device {
  const device = getDeviceOr404(id);
  if (input.name !== undefined) {
    getDb().update(devices).set({ name: input.name }).where(eq(devices.id, id)).run();
  }
  if (input.assignment) {
    requireClaimed(device);
    return applyAssignment(id, input.assignment);
  }
  return getDeviceOr404(id);
}

/** Sets what a device should show, updates rotation, and tells the device to navigate. */
export function applyAssignment(id: string, assignment: DeviceAssignment): Device {
  const db = getDb();
  switch (assignment.type) {
    case 'none':
      db.update(devices)
        .set({
          assignmentType: 'none',
          screenId: null,
          playlistId: null,
          currentScreenId: null,
          playlistPosition: 0,
        })
        .where(eq(devices.id, id))
        .run();
      break;
    case 'screen':
      if (!findScreen(assignment.screenId)) throw notFound('Screen');
      db.update(devices)
        .set({
          assignmentType: 'screen',
          screenId: assignment.screenId,
          playlistId: null,
          currentScreenId: assignment.screenId,
          playlistPosition: 0,
        })
        .where(eq(devices.id, id))
        .run();
      break;
    case 'playlist': {
      if (
        !db
          .select({ id: playlists.id })
          .from(playlists)
          .where(eq(playlists.id, assignment.playlistId))
          .get()
      ) {
        throw notFound('Playlist');
      }
      const first = playlistItemsFor(assignment.playlistId)[0];
      db.update(devices)
        .set({
          assignmentType: 'playlist',
          screenId: null,
          playlistId: assignment.playlistId,
          currentScreenId: first?.screenId ?? null,
          playlistPosition: 0,
        })
        .where(eq(devices.id, id))
        .run();
      break;
    }
  }
  const device = getDeviceOr404(id);
  syncDevice(id);
  publish(id, { type: 'navigate', screenId: device.currentScreenId });
  return getDeviceOr404(id);
}

// ---- Native commands (handled by the Android app, delivered with the heartbeat ack) ----

const NATIVE_COMMANDS: readonly NativeCommandType[] = [
  'openExitMenu',
  'openSettings',
  'exitStrictMode',
];
const NATIVE_COMMAND_TTL_MS = 5 * 60_000;
type NativeQueue = Map<string, { type: NativeCommandType; at: number }[]>;
const globalForNative = globalThis as unknown as { __showrunnerNativeCommands?: NativeQueue };
const nativeQueues: NativeQueue = (globalForNative.__showrunnerNativeCommands ??= new Map());

/** Reports whether a command type is handled by the Android app itself. */
export const isNativeCommand = (type: string): type is NativeCommandType =>
  (NATIVE_COMMANDS as readonly string[]).includes(type);

/** Returns and clears commands queued for the device (dropping ones older than 5 minutes). */
export function takeNativeCommands(deviceId: string, now = Date.now()): NativeCommandType[] {
  const queue = nativeQueues.get(deviceId) ?? [];
  nativeQueues.delete(deviceId);
  return queue.filter((c) => now - c.at < NATIVE_COMMAND_TTL_MS).map((c) => c.type);
}

/** Delivers a kiosk command over SSE, queueing native commands for the next heartbeat. */
export function sendCommand(
  device: Device,
  command: DeviceCommandRequest,
): { delivered: number; queued?: boolean } {
  if (isNativeCommand(command.type)) {
    const queue = (nativeQueues.get(device.id) ?? []).filter((c) => c.type !== command.type);
    nativeQueues.set(device.id, [...queue, { type: command.type, at: Date.now() }]);
    return { delivered: 0, queued: true };
  }
  if (command.type === 'navigate') {
    requireClaimed(device);
    if (!findScreen(command.screenId)) throw notFound('Screen');
    getDb()
      .update(devices)
      .set({ currentScreenId: command.screenId })
      .where(eq(devices.id, device.id))
      .run();
    // Restart the dwell timer so the manually chosen screen gets a full slot.
    if (device.assignmentType === 'playlist') syncDevice(device.id, { holdCurrentScreen: true });
    return { delivered: publish(device.id, { type: 'navigate', screenId: command.screenId }) };
  }
  return {
    delivered: publish(
      device.id,
      command as Exclude<DeviceCommandRequest, { type: NativeCommandType } | { type: 'navigate' }>,
    ),
  };
}

/** Deletes a device and tells its open connections to reload. */
export function deleteDevice(id: string): void {
  getDeviceOr404(id);
  getDb().delete(devices).where(eq(devices.id, id)).run();
  syncDevice(id);
  publish(id, { type: 'reload' });
}

/** The screen the device should render right now, if any. */
export function currentScreenOf(device: Device): Screen | null {
  return device.currentScreenId ? (findScreen(device.currentScreenId) ?? null) : null;
}

// ---- Logs --------------------------------------------------------------------

const LOG_RATE_PER_MINUTE = 60;
const globalForLogs = globalThis as unknown as {
  __showrunnerLogRate?: Map<string, { windowStart: number; count: number }>;
};
const logRate = (globalForLogs.__showrunnerLogRate ??= new Map());

/** Stores a device log line. Returns false when rate-limited (the line is dropped). */
export function appendLog(
  device: Device,
  input: DeviceLogRequest,
  userAgent: string | null,
): boolean {
  const now = Date.now();
  const bucket = logRate.get(device.id);
  if (!bucket || now - bucket.windowStart > 60_000) {
    logRate.set(device.id, { windowStart: now, count: 1 });
  } else if (++bucket.count > LOG_RATE_PER_MINUTE) {
    return false;
  }
  const db = getDb();
  db.insert(deviceLogs)
    .values({
      deviceId: device.id,
      level: input.level ?? 'error',
      message: input.message,
      context: {
        source: input.source ?? null,
        line: input.line ?? null,
        column: input.column ?? null,
        stack: input.stack ?? null,
        url: input.url ?? null,
        screenId: input.screenId ?? null,
        userAgent,
      },
    })
    .run();
  db.run(sql`
    DELETE FROM ${deviceLogs}
    WHERE ${deviceLogs.deviceId} = ${device.id}
      AND ${deviceLogs.id} <= (
        SELECT ${deviceLogs.id} FROM ${deviceLogs}
        WHERE ${deviceLogs.deviceId} = ${device.id}
        ORDER BY ${deviceLogs.id} DESC LIMIT 1 OFFSET ${MAX_LOGS_PER_DEVICE}
      )`);
  return true;
}

/** Lists a device's stored log lines, newest first. */
export function listLogs(deviceId: string, query: DeviceLogsQuery): DeviceLog[] {
  return getDb()
    .select()
    .from(deviceLogs)
    .where(
      query.before === undefined
        ? eq(deviceLogs.deviceId, deviceId)
        : and(eq(deviceLogs.deviceId, deviceId), lt(deviceLogs.id, query.before)),
    )
    .orderBy(desc(deviceLogs.id))
    .limit(query.limit)
    .all();
}
