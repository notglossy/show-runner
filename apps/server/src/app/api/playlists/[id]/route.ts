import { parseJson, route } from '@/lib/api/http';
import { UpdatePlaylistRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { deletePlaylist, getPlaylistOr404, updatePlaylist } from '@/lib/playlists/service';

type Ctx = RouteContext<'/api/playlists/[id]'>;

export const GET = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  return Response.json({ playlist: getPlaylistOr404((await params).id) });
});

export const PATCH = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  const input = await parseJson(req, UpdatePlaylistRequestSchema);
  return Response.json({ playlist: updatePlaylist((await params).id, input) });
});

export const DELETE = route(async (req, { params }: Ctx) => {
  requireAdmin(req);
  deletePlaylist((await params).id);
  return new Response(null, { status: 204 });
});
