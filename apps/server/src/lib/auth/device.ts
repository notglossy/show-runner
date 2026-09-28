import { eq } from 'drizzle-orm';

import { ApiError, notFound, unauthorized } from '@/lib/api/http';
import { getDb } from '@/lib/db/client';
import { type Device, devices } from '@/lib/db/schema';
import { registrationWindowOpen } from '@/lib/devices/registration';
import { env } from '@/lib/env';

import { bearerToken, isAdminRequest, readCookie } from './admin';
import { safeEqual, sha256 } from './crypto';

export const DEVICE_COOKIE = 'showrunner_device';
export const SHARED_SECRET_HEADER = 'x-kiosk-secret';

/** Throws 401 unless the `x-kiosk-secret` header matches the configured shared secret. */
export function requireSharedSecret(req: Request): void {
  const secret = env().DEVICE_SHARED_SECRET;
  const provided = req.headers.get(SHARED_SECRET_HEADER);
  if (!secret || !provided || !safeEqual(provided, secret)) {
    throw unauthorized(`Missing or invalid ${SHARED_SECRET_HEADER} header`);
  }
}

/**
 * Gate for `POST /api/devices/register`, in order:
 *  1. A device presenting its current (or grace-period previous) token may always re-register.
 *  2. With DEVICE_SHARED_SECRET set, the header is required and sufficient (managed fleets).
 *  3. Otherwise a claimed device id needs its token (nobody else may take over a claimed display),
 *     and a new or still-unclaimed device needs the dashboard's registration window to be open.
 */
export function authorizeRegistration(req: Request, deviceId: string): void {
  const device = getDb().select().from(devices).where(eq(devices.id, deviceId)).get();
  if (device && presentsDeviceToken(req, device)) return;
  if (env().DEVICE_SHARED_SECRET) {
    requireSharedSecret(req);
    return;
  }
  if (device?.claimedAt) {
    throw unauthorized('This display is already claimed; re-register with its device token');
  }
  if (!registrationWindowOpen()) {
    throw new ApiError(
      403,
      'registration_closed',
      'Registration is closed. In the dashboard, open Devices and choose "Add a display".',
    );
  }
}

/** Cookie value set by the Android shell for the server origin: `<deviceId>.<token>`. */
export const deviceCookieValue = (deviceId: string, token: string) => `${deviceId}.${token}`;

function presentedTokens(req: Request, deviceId: string): string[] {
  const tokens: string[] = [];
  const bearer = bearerToken(req);
  if (bearer) tokens.push(bearer);
  const cookie = readCookie(req, DEVICE_COOKIE);
  if (cookie) {
    const dot = cookie.indexOf('.');
    if (dot > 0 && cookie.slice(0, dot) === deviceId) tokens.push(cookie.slice(dot + 1));
  }
  return tokens;
}

/** Whether the request carries the device's current token, or its previous one within the grace period. */
function presentsDeviceToken(req: Request, device: Device): boolean {
  const previousValid =
    device.previousTokenHash && (device.previousTokenExpiresAt?.getTime() ?? 0) > Date.now();
  for (const token of presentedTokens(req, device.id)) {
    const hash = sha256(token);
    if (safeEqual(hash, device.tokenHash)) return true;
    if (previousValid && safeEqual(hash, device.previousTokenHash!)) return true;
  }
  return false;
}

export type Viewer = { kind: 'device'; device: Device } | { kind: 'admin'; device: Device };

/**
 * Per-device endpoints accept the device's own token (Bearer or cookie) or an admin.
 * Unknown devices are 404 for admins and 401 for everyone else (no device enumeration).
 */
export function requireDeviceOrAdmin(req: Request, deviceId: string): Viewer {
  const device = getDb().select().from(devices).where(eq(devices.id, deviceId)).get();
  if (device && presentsDeviceToken(req, device)) return { kind: 'device', device };
  if (isAdminRequest(req)) {
    if (!device) throw notFound('Device');
    return { kind: 'admin', device };
  }
  throw unauthorized('Missing or invalid device token');
}

/** Like requireDeviceOrAdmin but rejects admins (for endpoints only the physical device should call). */
export function requireDevice(req: Request, deviceId: string): Device {
  const viewer = requireDeviceOrAdmin(req, deviceId);
  if (viewer.kind !== 'device')
    throw new ApiError(403, 'forbidden', 'Only the device itself may call this endpoint');
  return viewer.device;
}
