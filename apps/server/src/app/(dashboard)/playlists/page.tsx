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
          className="label-mono bg-signal hover:bg-ink hover:text-signal-tint inline-flex h-10 items-center rounded px-5 text-white"
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
              <tr className="caption-mono border-ink text-subtle border-b text-left">
                <th className="pr-3 pb-2 font-normal">Name</th>
                <th className="pr-3 pb-2 font-normal">Screens</th>
                <th className="pr-3 pb-2 font-normal">Loop</th>
                <th className="pr-3 pb-2 font-normal">Devices</th>
              </tr>
            </thead>
            <tbody className="divide-graphite/30 divide-y">
              {playlists.map((p) => (
                <tr key={p.id}>
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/playlists/${p.id}`}
                      className="text-ink font-medium underline-offset-2 hover:underline"
                    >
                      {p.name}
                    </Link>
                  </td>
                  <td className="text-subtle py-2.5 pr-3">{p.itemCount}</td>
                  <td className="text-subtle py-2.5 pr-3">
                    {p.totalSeconds ? duration(p.totalSeconds) : '—'}
                  </td>
                  <td className="text-subtle py-2.5">{p.deviceCount || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
