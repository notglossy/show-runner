import Link from 'next/link';
import { Card, Empty, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { duration } from '@/lib/client/format';
import { listDevices } from '@/lib/devices/service';
import { listPlaylists } from '@/lib/playlists/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function PlaylistsPage() {
  await requireAdminPage('/playlists');
  const devices = listDevices();
  const playlists = listPlaylists().map((p) => ({
    ...p,
    deviceCount: devices.filter((d) => d.playlistId === p.id).length,
  }));
  return (
    <>
      <PageHeader title="Playlists">
        <Link
          href="/playlists/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New playlist
        </Link>
      </PageHeader>
      <Card>
        {playlists.length === 0 ? (
          <Empty>No playlists yet. A playlist rotates a device through several screens.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Screens</th>
                <th className="pb-2 font-medium">Loop</th>
                <th className="pb-2 font-medium">Devices</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {playlists.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/playlists/${p.id}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-2.5 pr-3 text-neutral-600">{p.itemCount}</td>
                  <td className="py-2.5 pr-3 text-neutral-600">
                    {p.totalSeconds ? duration(p.totalSeconds) : '—'}
                  </td>
                  <td className="py-2.5 text-neutral-600">{p.deviceCount || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
