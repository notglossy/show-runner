import type { DataProvider } from "./types";

export interface DeviceData {
  id: string;
  name: string | null;
  claimed: boolean;
  model: string;
  appVersion: string;
  screenWidth: number;
  screenHeight: number;
  battery: { level: number; charging: boolean } | null;
  /** bars: 0-4 derived from rssi. */
  wifi: { rssi: number; ssid: string | null; bars: number } | null;
  lastSeenAt: string | null;
}

export function wifiBars(rssi: number): number {
  if (rssi >= -55) return 4;
  if (rssi >= -66) return 3;
  if (rssi >= -77) return 2;
  if (rssi >= -88) return 1;
  return 0;
}

export const deviceProvider: DataProvider<"device", DeviceData> = {
  key: "device",
  scope: "device",
  ttlMs: 0,
  async fetch({ device }) {
    const { battery, wifi } = device.status;
    return {
      id: device.id,
      name: device.name,
      claimed: device.claimedAt !== null,
      model: device.model,
      appVersion: device.status.appVersion ?? device.appVersion,
      screenWidth: device.screenWidth,
      screenHeight: device.screenHeight,
      battery: battery ?? null,
      wifi: wifi ? { rssi: wifi.rssi, ssid: wifi.ssid ?? null, bars: wifiBars(wifi.rssi) } : null,
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    };
  },
  fallback(_error, ctx) {
    throw new Error(`device provider cannot fail (device ${ctx.device.id})`);
  },
};
