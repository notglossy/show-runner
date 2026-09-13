import { parseJson, route } from "@/lib/api/http";
import { ClaimDeviceRequestSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/admin";
import { claimDevice, toDeviceView } from "@/lib/devices/service";

export const POST = route(async (req) => {
  requireAdmin(req);
  const input = await parseJson(req, ClaimDeviceRequestSchema);
  return Response.json({ device: toDeviceView(claimDevice(input)) });
});
