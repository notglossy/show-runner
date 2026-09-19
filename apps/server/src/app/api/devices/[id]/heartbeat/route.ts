import { parseJson, route } from '@/lib/api/http';
import { clientIp } from '@/lib/api/request';
import { HeartbeatRequestSchema } from '@/lib/api/schemas';
import { requireDevice } from '@/lib/auth/device';
import {
  HEARTBEAT_INTERVAL_SECONDS,
  recordHeartbeat,
  takeNativeCommands,
} from '@/lib/devices/service';
import { connectionCount } from '@/lib/events/bus';
import { getKioskPinHash } from '@/lib/settings/service';

/** Device-facing. The response is the watchdog's ack. */
export const POST = route(async (req, { params }: RouteContext<'/api/devices/[id]/heartbeat'>) => {
  const device = requireDevice(req, (await params).id);
  const input = await parseJson(req, HeartbeatRequestSchema, 16 * 1024);
  const updated = recordHeartbeat(device, input, clientIp(req));
  return Response.json({
    ok: true,
    serverTime: Date.now(),
    claimed: updated.claimedAt !== null,
    currentScreenId: updated.currentScreenId,
    eventsConnected: connectionCount(updated.id, 'device') > 0,
    heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    kiosk: { exitPin: getKioskPinHash(), commands: takeNativeCommands(updated.id) },
  });
});
