'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

import { Logo } from '@/components/logo';
import { api } from '@/lib/client/api';

const LINKS = [
  { href: '/devices', label: 'Devices' },
  { href: '/screens', label: 'Screens' },
  { href: '/playlists', label: 'Playlists' },
  { href: '/settings', label: 'Settings' },
];

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <header className="bg-ink text-steel flex shrink-0 flex-col gap-6 px-4 py-5 md:sticky md:top-0 md:h-screen md:w-64 md:gap-10 md:px-6 md:py-8">
      <Link href="/devices" className="focus-visible:outline-signal-tint flex self-start">
        <Logo tone="dark" className="h-6 w-auto" />
      </Link>
      <nav aria-label="Main" className="flex flex-row flex-wrap gap-0.5 md:flex-col">
        {LINKS.map((link, i) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`label-mono focus-visible:outline-signal-tint flex gap-3 rounded p-3 ${active ? 'bg-signal text-white' : 'text-steel hover:bg-gunmetal hover:text-white'}`}
            >
              {/* Zero-padded index, the dashboard's numbered-list voice. */}
              <span className={active ? undefined : 'text-concrete'}>{`0${i + 1}.`}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <button
        type="button"
        onClick={logout}
        className="label-mono text-concrete focus-visible:outline-signal-tint self-start hover:text-white md:mt-auto"
      >
        Log out
      </button>
    </header>
  );
}
