import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DeviceCommandRequestSchema, UpdateSettingsRequestSchema } from "@/lib/api/schemas";
import { getKioskPinHash, getSettings, hashKioskPin, updateSettings } from "@/lib/settings/service";
import { recordHeartbeat, registerDevice, sendCommand, takeNativeCommands } from "./service";

const reg = () =>
  registerDevice({ deviceId: randomUUID(), model: "m", androidVersion: "11", appVersion: "1", screenWidth: 1280, screenHeight: 800 }, null).device;

describe("native kiosk commands", () => {
  it("queues native commands per device, de-duplicates, and hands them out once", () => {
    const a = reg();
    const b = reg();
    expect(sendCommand(a, { type: "openExitMenu" })).toEqual({ delivered: 0, queued: true });
    sendCommand(a, { type: "openSettings" });
    sendCommand(a, { type: "openExitMenu" });
    expect(takeNativeCommands(a.id)).toEqual(["openSettings", "openExitMenu"]);
    expect(takeNativeCommands(a.id)).toEqual([]);
    expect(takeNativeCommands(b.id)).toEqual([]);
  });

  it("drops commands that were never collected within 5 minutes", () => {
    const d = reg();
    sendCommand(d, { type: "exitStrictMode" });
    expect(takeNativeCommands(d.id, Date.now() + 5 * 60_000 + 1)).toEqual([]);
  });

  it("accepts the new command types and kiosk heartbeat fields", () => {
    for (const type of ["openExitMenu", "openSettings", "exitStrictMode"]) {
      expect(DeviceCommandRequestSchema.safeParse({ type }).success).toBe(true);
    }
    const d = reg();
    const updated = recordHeartbeat(d, { kioskMode: "launcher", isDefaultHome: true }, null);
    expect(updated.status).toMatchObject({ kioskMode: "launcher", isDefaultHome: true });
  });
});

describe("kiosk exit PIN", () => {
  it("stores only a salted hash, reports whether it is set, and can be removed", () => {
    expect(getSettings().kioskExitPinSet).toBe(false);
    updateSettings({ kioskExitPin: "2468" });
    const hash = getKioskPinHash()!;
    expect(hash.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(hash.sha256).toBe(hashKioskPin("2468", hash.salt));
    expect(JSON.stringify(getSettings())).not.toContain("2468");
    expect(getSettings()).toMatchObject({ kioskExitPinSet: true, overrides: {} });

    updateSettings({ kioskExitPin: null });
    expect(getKioskPinHash()).toBeNull();
  });

  it("validates PIN format", () => {
    expect(UpdateSettingsRequestSchema.safeParse({ kioskExitPin: "123" }).success).toBe(false);
    expect(UpdateSettingsRequestSchema.safeParse({ kioskExitPin: "123456789" }).success).toBe(false);
    expect(UpdateSettingsRequestSchema.safeParse({ kioskExitPin: "12a4" }).success).toBe(false);
    expect(UpdateSettingsRequestSchema.safeParse({ kioskExitPin: "0042" }).success).toBe(true);
  });
});
