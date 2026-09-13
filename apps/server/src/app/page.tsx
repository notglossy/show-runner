import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { listDevices, toDeviceView } from "@/lib/devices/service";
import { listScreens } from "@/lib/screens/service";

export const dynamic = "force-dynamic";

/** Placeholder admin home. The real dashboard arrives in Phase 3. */
export default async function Home() {
  await requireAdminPage("/");
  const devices = listDevices().map((d) => toDeviceView(d));
  const screens = listScreens();
  return (
    <main className="mx-auto max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">ShowKiosk</h1>
      <p className="mb-6 text-neutral-600">Dashboard coming in Phase 3. Use the API for now.</p>
      <h2 className="mb-2 font-semibold">Devices</h2>
      <ul className="mb-6 list-disc pl-6">
        {devices.map((d) => (
          <li key={d.id}>
            <Link className="underline" href={`/device/${d.id}`}>
              {d.name ?? `Unclaimed (${d.pairingCode})`}
            </Link>{" "}
            <span className="text-neutral-500">
              {d.online ? "online" : "offline"} · {d.assignment.type}
            </span>
          </li>
        ))}
        {devices.length === 0 && <li className="text-neutral-500">No devices registered yet.</li>}
      </ul>
      <h2 className="mb-2 font-semibold">Screens</h2>
      <ul className="list-disc pl-6">
        {screens.map((s) => (
          <li key={s.id}>
            {s.name} <code className="text-neutral-500">{s.id}</code>
          </li>
        ))}
      </ul>
    </main>
  );
}
