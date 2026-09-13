import { env } from "@/lib/env";
import { hmacSha256, safeEqual, sha256 } from "./crypto";
import { unauthorized } from "@/lib/api/http";

export const ADMIN_COOKIE = "showrunner_admin";
export const ADMIN_SESSION_MS = 30 * 24 * 60 * 60 * 1000;

// Derived from the password, so changing ADMIN_PASSWORD invalidates every session.
const sessionKey = () => sha256(`showrunner-admin-session:${env().ADMIN_PASSWORD}`);

export function checkAdminPassword(candidate: string): boolean {
  return safeEqual(candidate, env().ADMIN_PASSWORD);
}

/** Cookie value: `v1.<expiresAtMs>.<hmac>`. */
export function createAdminSession(now = Date.now()): { value: string; expiresAt: Date } {
  const expiresAt = now + ADMIN_SESSION_MS;
  const payload = `v1.${expiresAt}`;
  return { value: `${payload}.${hmacSha256(sessionKey(), payload)}`, expiresAt: new Date(expiresAt) };
}

export function verifyAdminSession(value: string | undefined, now = Date.now()): boolean {
  if (!value) return false;
  const [version, expires, mac] = value.split(".");
  if (version !== "v1" || !expires || !mac) return false;
  if (!safeEqual(mac, hmacSha256(sessionKey(), `${version}.${expires}`))) return false;
  return Number(expires) > now;
}

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}

export function bearerToken(req: Request): string | undefined {
  const header = req.headers.get("authorization");
  const match = header?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

/** Admin = valid session cookie, or `Authorization: Bearer <ADMIN_PASSWORD>`. */
export function isAdminRequest(req: Request): boolean {
  if (verifyAdminSession(readCookie(req, ADMIN_COOKIE))) return true;
  const bearer = bearerToken(req);
  return bearer !== undefined && checkAdminPassword(bearer);
}

export function requireAdmin(req: Request): void {
  if (!isAdminRequest(req)) throw unauthorized();
}

export function adminCookieHeader(value: string, expiresAt: Date, secure: boolean): string {
  return [
    `${ADMIN_COOKIE}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Expires=${expiresAt.toUTCString()}`,
    ...(secure ? ["Secure"] : []),
  ].join("; ");
}

export function clearAdminCookieHeader(): string {
  return `${ADMIN_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
