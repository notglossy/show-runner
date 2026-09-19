import { notFound } from 'next/navigation';

import { PlaylistEditor } from '@/components/playlist-editor';
import { PageHeader } from '@/components/ui';
import { ApiError } from '@/lib/api/http';
import { requireAdminPage } from '@/lib/auth/session';
import { listDevices } from '@/lib/devices/service';
import { getPlaylistOr404 } from '@/lib/playlists/service';
import { listScreens } from '@/lib/screens/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function PlaylistPage({ params }: PageProps<'/playlists/[id]'>) {
  const { id } = await params;
  await requireAdminPage(`/playlists/${id}`);
  let playlist;
  try {
    playlist = getPlaylistOr404(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }
  const screens = listScreens().map(({ id, name }) => ({ id, name }));
  const devices = listDevices()
    .filter((d) => d.playlistId === id)
    .map((d) => ({ id: d.id, name: d.name }));
  return (
    <>
      <PageHeader title={playlist.name} />
      <PlaylistEditor key={playlist.id} playlist={playlist} screens={screens} devices={devices} />
    </>
  );
}
