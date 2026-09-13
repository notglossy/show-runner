import { route } from "@/lib/api/http";
import { requireDeviceOrAdmin } from "@/lib/auth/device";
import { currentScreenOf } from "@/lib/devices/service";
import { buildDataPayload } from "@/lib/providers/payload";

export const GET = route(async (req, { params }: RouteContext<"/api/devices/[id]/data">) => {
  const { device } = requireDeviceOrAdmin(req, (await params).id);
  const payload = await buildDataPayload(device, currentScreenOf(device));
  return Response.json(payload, { headers: { "cache-control": "no-store" } });
});
