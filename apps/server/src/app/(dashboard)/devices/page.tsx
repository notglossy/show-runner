import Link from 'next/link';
import { AssignmentSelect } from '@/components/assignment-select';
import { AutoRefresh } from '@/components/auto-refresh';
import { ClaimDevice } from '@/components/claim-device';
import { DeviceStatus } from '@/components/device-status';
import { TimeAgo } from '@/components/time-ago';
import { Card, Empty, PageHeader } from '@/components/ui';
import { requireAdminPage } from '@/lib/auth/session';
import { listDevices, toDeviceView } from '@/lib/devices/service';
import { listPlaylists } from '@/lib/playlists/service';
import { listScreens } from '@/lib/screens/service';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export default async function DevicesPage() {
  await requireAdminPage('/devices');
  const devices = listDevices().map((d) => toDeviceView(d));
  const screens = listScreens().map(({ id, name }) => ({ id, name }));
  const playlists = listPlaylists().map(({ id, name }) => ({ id, name }));
  const screenName = new Map(screens.map((s) => [s.id, s.name]));
  const unclaimed = devices.filter((d) => !d.claimed);
  const claimed = devices.filter((d) => d.claimed);

  return (
    <>
      <AutoRefresh seconds={10} />
      <PageHeader title="Devices" />

      {unclaimed.length > 0 && (
        <Card title="Waiting to be claimed" className="mb-6">
          <p className="mb-3 text-sm text-neutral-600">
            These displays have registered. Check the pairing code shown on the screen matches
            before claiming.
          </p>
          <ul className="divide-y divide-neutral-100">
            {unclaimed.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-4 py-3">
                <div className="w-36">
                  <div className="font-mono text-2xl font-semibold tracking-widest text-neutral-900">
                    {d.pairingCode}
                  </div>
                  <div className="text-xs text-neutral-500">
                    {d.model} · registered <TimeAgo iso={d.registeredAt} />
                  </div>
                </div>
                <div className="min-w-72 flex-1">
                  <ClaimDevice pairingCode={d.pairingCode ?? ''} />
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card title="Displays">
        {claimed.length === 0 ? (
          <Empty>No claimed displays yet. Install the app on a device and claim it here.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-neutral-500">
                  <th className="pb-2 font-medium">Name</th>
                  <th className="pb-2 font-medium">Status</th>
                  <th className="pb-2 font-medium">Last seen</th>
                  <th className="pb-2 font-medium">Showing</th>
                  <th className="w-64 pb-2 font-medium">Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {claimed.map((d) => (
                  <tr key={d.id}>
                    <td className="py-2.5 pr-3">
                      <Link
                        href={`/devices/${d.id}`}
                        className="font-medium text-neutral-900 underline-offset-2 hover:underline"
                      >
                        {d.name}
                      </Link>
                      <div className="text-xs text-neutral-500">{d.model}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <DeviceStatus device={d} />
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-600">
                      <TimeAgo iso={d.lastSeenAt} />
                    </td>
                    <td className="py-2.5 pr-3 text-neutral-700">
                      {d.currentScreenId ? (screenName.get(d.currentScreenId) ?? '—') : '—'}
                    </td>
                    <td className="py-2.5">
                      <AssignmentSelect
                        deviceId={d.id}
                        assignment={d.assignment}
                        screens={screens}
                        playlists={playlists}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Claim by code" className="mt-6">
        <p className="mb-3 text-sm text-neutral-600">
          Type the 6-character code shown on a display.
        </p>
        <ClaimDevice />
      </Card>
    </>
  );
}
