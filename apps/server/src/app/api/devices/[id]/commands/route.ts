import { parseJson, route } from '@/lib/api/http';
import { DeviceCommandRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { getDeviceOr404, sendCommand } from '@/lib/devices/service';

export const POST = route(async (req, { params }: RouteContext<'/api/devices/[id]/commands'>) => {
  requireAdmin(req);
  const device = getDeviceOr404((await params).id);
  const command = await parseJson(req, DeviceCommandRequestSchema);
  return Response.json(sendCommand(device, command));
});
