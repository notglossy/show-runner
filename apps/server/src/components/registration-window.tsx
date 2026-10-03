'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import type { RegistrationStatus } from '@/lib/api/types';
import { api, ApiClientError } from '@/lib/client/api';

import { Badge, Button, Card, ErrorText } from './ui';

function countdown(closesAt: string, now: number): string {
  const left = Math.max(0, Math.round((Date.parse(closesAt) - now) / 1000));
  return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/** "Add a display": opens the registration window and counts it down; explains secret mode instead. */
export function RegistrationWindow({ status }: { status: RegistrationStatus }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const open = status.mode === 'window' && status.open && status.closesAt !== null;

  // Tick the countdown; once it hits zero, re-render from the server so the window reads closed.
  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (status.closesAt && Date.parse(status.closesAt) <= t) router.refresh();
    }, 1000);
    return () => clearInterval(id);
  }, [open, status.closesAt, router]);

  async function set(openNext: boolean) {
    setPending(true);
    setError(null);
    try {
      await api('/api/devices/registration', { method: 'PUT', body: { open: openNext } });
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    } finally {
      setPending(false);
    }
  }

  if (status.mode === 'secret') {
    return (
      <Card title="Add a display" actions={<Badge tone="gray">Shared secret</Badge>}>
        <p className="text-subtle text-sm">
          This server has <code>DEVICE_SHARED_SECRET</code> set, so displays register at any time by
          sending it. Install the app with this server&apos;s address and the secret; the
          display&apos;s pairing code appears here within a minute.
        </p>
      </Card>
    );
  }

  return (
    <Card
      title="Add a display"
      actions={
        open ? (
          <Badge tone="green">Open · {countdown(status.closesAt!, now)} left</Badge>
        ) : (
          <Badge tone="gray">Closed</Badge>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-subtle flex-1 text-sm">
          {open
            ? 'Waiting for a display to register. Point the app at this server; its pairing code appears below. The window closes when you claim a display.'
            : 'New displays can register for 10 minutes after you open registration. Displays you have already claimed reconnect on their own.'}
        </p>
        {open ? (
          <Button onClick={() => set(false)} disabled={pending}>
            Close now
          </Button>
        ) : (
          <Button variant="primary" onClick={() => set(true)} disabled={pending}>
            {pending ? 'Opening…' : 'Add a display'}
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}
