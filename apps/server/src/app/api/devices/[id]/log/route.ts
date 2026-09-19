import { parseJson, route } from '@/lib/api/http';
import { DeviceLogRequestSchema } from '@/lib/api/schemas';
import { requireDevice } from '@/lib/auth/device';
import { appendLog } from '@/lib/devices/service';

/** Device-facing (called by the kiosk runtime). 202 = stored, 429 = rate limited and dropped. */
export const POST = route(async (req, { params }: RouteContext<'/api/devices/[id]/log'>) => {
  const device = requireDevice(req, (await params).id);
  const input = await parseJson(req, DeviceLogRequestSchema, 32 * 1024);
  const stored = appendLog(device, input, req.headers.get('user-agent'));
  return Response.json({ stored }, { status: stored ? 202 : 429 });
});
