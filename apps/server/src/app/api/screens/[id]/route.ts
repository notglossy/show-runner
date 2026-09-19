import { parseJson, route } from '@/lib/api/http';
import { UpdateScreenRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { deleteScreen, getScreenOr404, updateScreen } from '@/lib/screens/service';

type Ctx = RouteContext<'/api/screens/[id]'>;
const MAX_BODY = 600 * 1024;

export const GET = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  return Response.json({ screen: getScreenOr404((await params).id) });
});

export const PATCH = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  const input = await parseJson(req, UpdateScreenRequestSchema, MAX_BODY);
  return Response.json({ screen: updateScreen((await params).id, input) });
});

export const DELETE = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  deleteScreen((await params).id);
  return new Response(null, { status: 204 });
});
