import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { registerDevice } from "@/lib/devices/service";
import { ADMIN_SESSION_MS, createAdminSession, isAdminRequest, verifyAdminSession } from "./admin";
import { randomPairingCode, safeEqual } from "./crypto";
import { requireDevice, requireDeviceOrAdmin, requireSharedSecret } from "./device";

const req = (headers: Record<string, string> = {}) => new Request("http://kiosk.local/x", { headers });

describe("admin auth", () => {
  it("accepts a fresh session, rejects tampered or expired ones", () => {
    const now = Date.now();
    const { value } = createAdminSession(now);
    expect(verifyAdminSession(value, now)).toBe(true);
    expect(verifyAdminSession(value.replace(/.$/, (c) => (c === "a" ? "b" : "a")), now)).toBe(false);
    expect(verifyAdminSession(value, now + ADMIN_SESSION_MS + 1)).toBe(false);
    expect(verifyAdminSession(`v1.${now + 10 ** 9}.deadbeef`, now)).toBe(false);
    expect(verifyAdminSession(undefined)).toBe(false);
  });

  it("recognises the session cookie or the Bearer password", () => {
    const { value } = createAdminSession();
    expect(isAdminRequest(req({ cookie: `other=1; showkiosk_admin=${encodeURIComponent(value)}` }))).toBe(true);
    expect(isAdminRequest(req({ authorization: "Bearer test-admin-password" }))).toBe(true);
    expect(isAdminRequest(req({ authorization: "Bearer wrong" }))).toBe(false);
    expect(isAdminRequest(req())).toBe(false);
  });
});

describe("device auth", () => {
  const register = () =>
    registerDevice(
      { deviceId: randomUUID(), model: "m", androidVersion: "11", appVersion: "1", screenWidth: 1280, screenHeight: 800 },
      null,
    );

  it("requires the shared secret header for registration", () => {
    expect(() => requireSharedSecret(req())).toThrow(/x-kiosk-secret/);
    expect(() => requireSharedSecret(req({ "x-kiosk-secret": "nope" }))).toThrow();
    expect(() => requireSharedSecret(req({ "x-kiosk-secret": "test-device-secret" }))).not.toThrow();
  });

  it("accepts the device token via Bearer or cookie, only for its own device", () => {
    const a = register();
    const b = register();
    expect(requireDeviceOrAdmin(req({ authorization: `Bearer ${a.token}` }), a.device.id).kind).toBe("device");
    expect(requireDeviceOrAdmin(req({ cookie: `showkiosk_device=${a.device.id}.${a.token}` }), a.device.id).kind).toBe("device");
    expect(() => requireDeviceOrAdmin(req({ authorization: `Bearer ${a.token}` }), b.device.id)).toThrow(/token/);
    expect(() => requireDeviceOrAdmin(req({ cookie: `showkiosk_device=${b.device.id}.${a.token}` }), b.device.id)).toThrow();
  });

  it("invalidates the old token when the device re-registers", () => {
    const first = register();
    const again = registerDevice(
      { deviceId: first.device.id, model: "m", androidVersion: "11", appVersion: "1", screenWidth: 1280, screenHeight: 800 },
      null,
    );
    expect(() => requireDevice(req({ authorization: `Bearer ${first.token}` }), first.device.id)).toThrow();
    expect(requireDevice(req({ authorization: `Bearer ${again.token}` }), first.device.id).id).toBe(first.device.id);
  });

  it("lets admins view any device but not act as one; hides unknown devices from non-admins", () => {
    const a = register();
    const admin = req({ authorization: "Bearer test-admin-password" });
    expect(requireDeviceOrAdmin(admin, a.device.id).kind).toBe("admin");
    expect(() => requireDevice(admin, a.device.id)).toThrow(/Only the device/);
    expect(() => requireDeviceOrAdmin(admin, "missing")).toThrow(/not found/);
    expect(() => requireDeviceOrAdmin(req(), "missing")).toThrow(/token/);
  });
});

describe("crypto helpers", () => {
  it("generates readable pairing codes and compares safely", () => {
    for (let i = 0; i < 200; i++) expect(randomPairingCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abcd")).toBe(false);
  });
});
