import { eq } from "drizzle-orm";
import { ApiError, notFound, unauthorized } from "@/lib/api/http";
import { getDb } from "@/lib/db/client";
import { devices, type Device } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { isAdminRequest, bearerToken, readCookie } from "./admin";
import { safeEqual, sha256 } from "./crypto";

export const DEVICE_COOKIE = "showrunner_device";
export const SHARED_SECRET_HEADER = "x-kiosk-secret";

export function requireSharedSecret(req: Request): void {
  const provided = req.headers.get(SHARED_SECRET_HEADER);
  if (!provided || !safeEqual(provided, env().DEVICE_SHARED_SECRET)) {
    throw unauthorized(`Missing or invalid ${SHARED_SECRET_HEADER} header`);
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
    const dot = cookie.indexOf(".");
    if (dot > 0 && cookie.slice(0, dot) === deviceId) tokens.push(cookie.slice(dot + 1));
  }
  return tokens;
}

export type Viewer = { kind: "device"; device: Device } | { kind: "admin"; device: Device };

/**
 * Per-device endpoints accept the device's own token (Bearer or cookie) or an admin.
 * Unknown devices are 404 for admins and 401 for everyone else (no device enumeration).
 */
export function requireDeviceOrAdmin(req: Request, deviceId: string): Viewer {
  const device = getDb().select().from(devices).where(eq(devices.id, deviceId)).get();
  if (device) {
    const previousValid = device.previousTokenHash && (device.previousTokenExpiresAt?.getTime() ?? 0) > Date.now();
    for (const token of presentedTokens(req, deviceId)) {
      const hash = sha256(token);
      if (safeEqual(hash, device.tokenHash)) return { kind: "device", device };
      if (previousValid && safeEqual(hash, device.previousTokenHash!)) return { kind: "device", device };
    }
  }
  if (isAdminRequest(req)) {
    if (!device) throw notFound("Device");
    return { kind: "admin", device };
  }
  throw unauthorized("Missing or invalid device token");
}

/** Like requireDeviceOrAdmin but rejects admins (for endpoints only the physical device should call). */
export function requireDevice(req: Request, deviceId: string): Device {
  const viewer = requireDeviceOrAdmin(req, deviceId);
  if (viewer.kind !== "device") throw new ApiError(403, "forbidden", "Only the device itself may call this endpoint");
  return viewer.device;
}
