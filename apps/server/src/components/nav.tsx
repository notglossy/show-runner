'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

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
  // Phones only: the links sit behind a menu button. From md up the sidebar always shows them.
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const firstLinkRef = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    firstLinkRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function logout() {
    await api('/api/auth/logout', { method: 'POST' });
    router.push('/login');
    router.refresh();
  }
  return (
    <header className="bg-ink text-steel shrink-0 md:sticky md:top-0 md:flex md:h-screen md:w-64 md:flex-col md:gap-10 md:px-6 md:py-8">
      <div className="flex h-14 items-center justify-between px-4 md:h-auto md:px-0">
        <Link
          href="/devices"
          onClick={() => setOpen(false)}
          className="focus-visible:outline-signal-tint flex"
        >
          <Logo tone="dark" className="h-6 w-auto" />
        </Link>
        <button
          ref={toggleRef}
          type="button"
          aria-label="Menu"
          aria-expanded={open}
          aria-controls="main-menu"
          onClick={() => setOpen((o) => !o)}
          className="focus-visible:outline-signal-tint -mr-2 rounded p-2 text-white md:hidden"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
            {open ? (
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" />
            )}
          </svg>
        </button>
      </div>
      <div
        id="main-menu"
        className={`${open ? 'flex' : 'hidden'} flex-col gap-6 px-4 pt-1 pb-5 md:flex md:flex-1 md:gap-10 md:p-0`}
      >
        <nav aria-label="Main" className="flex flex-col gap-0.5">
          {LINKS.map((link, i) => {
            const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                ref={i === 0 ? firstLinkRef : undefined}
                href={link.href}
                onClick={() => setOpen(false)}
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
      </div>
    </header>
  );
}
