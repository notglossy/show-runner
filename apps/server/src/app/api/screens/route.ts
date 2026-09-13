import { parseJson, route } from "@/lib/api/http";
import { CreateScreenRequestSchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/admin";
import { createScreen, listScreens } from "@/lib/screens/service";

const MAX_BODY = 600 * 1024;

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json({ screens: listScreens() });
});

export const POST = route(async (req) => {
  requireAdmin(req);
  const input = await parseJson(req, CreateScreenRequestSchema, MAX_BODY);
  return Response.json({ screen: createScreen(input) }, { status: 201 });
});
