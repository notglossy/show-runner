import { route, validate } from '@/lib/api/http';
import { DeviceLogsQuerySchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { getDeviceOr404, listLogs } from '@/lib/devices/service';

export const GET = route(async (req, { params }: RouteContext<'/api/devices/[id]/logs'>) => {
  requireAdmin(req);
  const device = getDeviceOr404((await params).id);
  const query = validate(DeviceLogsQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  return Response.json({ logs: listLogs(device.id, query) });
});
