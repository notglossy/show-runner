import { parseJson, route } from "@/lib/api/http";
import { clientIp } from "@/lib/api/request";
import { RegisterDeviceRequestSchema } from "@/lib/api/schemas";
import { DEVICE_COOKIE, deviceCookieValue, requireSharedSecret } from "@/lib/auth/device";
import { HEARTBEAT_INTERVAL_SECONDS, registerDevice } from "@/lib/devices/service";
import { deviceUrls } from "@/lib/render/document";
import { getKioskPinHash } from "@/lib/settings/service";

/** Device-facing. Requires the X-Kiosk-Secret header. Issues a new device token every call. */
export const POST = route(async (req) => {
  requireSharedSecret(req);
  const input = await parseJson(req, RegisterDeviceRequestSchema);
  const { device, token } = registerDevice(input, clientIp(req));
  return Response.json({
    deviceId: device.id,
    token,
    cookie: { name: DEVICE_COOKIE, value: deviceCookieValue(device.id, token) },
    claimed: device.claimedAt !== null,
    name: device.name,
    pairingCode: device.pairingCode,
    pageUrl: deviceUrls(device.id).page,
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    kiosk: { exitPin: getKioskPinHash() },
  });
});
