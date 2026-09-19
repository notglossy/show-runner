import { route } from '@/lib/api/http';
import { requireAdmin } from '@/lib/auth/admin';
import { listDevices, toDeviceView } from '@/lib/devices/service';

export const GET = route(async (req) => {
  requireAdmin(req);
  const now = Date.now();
  return Response.json({ devices: listDevices().map((d) => toDeviceView(d, now)) });
});
