import { parseJson, route } from "@/lib/api/http";
import { UpdateDeviceRequestSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/admin";
import { deleteDevice, getDeviceOr404, toDeviceView, updateDevice } from "@/lib/devices/service";

type Ctx = RouteContext<"/api/devices/[id]">;

export const GET = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  return Response.json({ device: toDeviceView(getDeviceOr404((await params).id)) });
});

export const PATCH = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  const input = await parseJson(req, UpdateDeviceRequestSchema);
  return Response.json({ device: toDeviceView(updateDevice((await params).id, input)) });
});

export const DELETE = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  deleteDevice((await params).id);
  return new Response(null, { status: 204 });
});
