import Link from 'next/link';

import { TimeAgo } from '@/components/time-ago';
import { Badge, Card, Empty, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { bytes } from '@/lib/client/format';
import { listScreens, screenUsage } from '@/lib/screens/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function ScreensPage() {
  await requireAdminPage('/screens');
  const screens = listScreens().map((s) => {
    const usage = screenUsage(s.id);
    return { ...s, used: usage.devices.length + usage.playlists.length };
  });
  return (
    <>
      <PageHeader title="Screens">
        <Link
          href="/screens/new"
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          New screen
        </Link>
      </PageHeader>
      <Card>
        {screens.length === 0 ? (
          <Empty>No screens yet.</Empty>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-neutral-500">
                <th className="pb-2 font-medium">Name</th>
                <th className="pb-2 font-medium">Source</th>
                <th className="pb-2 font-medium">Size</th>
                <th className="pb-2 font-medium">Used by</th>
                <th className="pb-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {screens.map((s) => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-3">
                    <Link
                      href={`/screens/${s.id}`}
                      className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                    >
                      {s.name}
                    </Link>
                    {s.description && (
                      <div className="text-xs text-neutral-500">{s.description}</div>
                    )}
                  </td>
                  <td className="py-2.5 pr-3">
                    <Badge
                      tone={s.source === 'ai' ? 'blue' : s.source === 'builtin' ? 'gray' : 'green'}
                    >
                      {s.source}
                    </Badge>
                  </td>
                  <td className="py-2.5 pr-3 text-neutral-600">{bytes(s.htmlBytes)}</td>
                  <td className="py-2.5 pr-3 text-neutral-600">{s.used || '—'}</td>
                  <td className="py-2.5 text-neutral-600">
                    <TimeAgo iso={s.updatedAt.toISOString()} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
