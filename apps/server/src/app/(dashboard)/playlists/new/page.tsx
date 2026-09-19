import { PlaylistEditor } from '@/components/playlist-editor';
import { PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { listScreens } from '@/lib/screens/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function NewPlaylistPage() {
  await requireAdminPage('/playlists/new');
  const screens = listScreens().map(({ id, name }) => ({ id, name }));
  return (
    <>
      <PageHeader title="New playlist" />
      <PlaylistEditor playlist={null} screens={screens} devices={[]} />
    </>
  );
}
