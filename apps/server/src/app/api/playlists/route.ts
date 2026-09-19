import { parseJson, route } from '@/lib/api/http';
import { CreatePlaylistRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import { createPlaylist, listPlaylists } from '@/lib/playlists/service';

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json({ playlists: listPlaylists() });
});

export const POST = route(async (req) => {
  requireAdmin(req);
  const input = await parseJson(req, CreatePlaylistRequestSchema);
  return Response.json({ playlist: createPlaylist(input) }, { status: 201 });
});
