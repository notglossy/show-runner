import { parseJson, route } from "@/lib/api/http";
import { UpdateSettingsRequestSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/admin";
import { getSettings, updateSettings } from "@/lib/settings/service";

export const dynamic = "force-dynamic";

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json(getSettings());
});

/** Body fields override env defaults; null clears an override. Connected devices refresh their data. */
export const PATCH = route(async (req) => {
  requireAdmin(req);
  const patch = await parseJson(req, UpdateSettingsRequestSchema);
  return Response.json(updateSettings(patch));
});
