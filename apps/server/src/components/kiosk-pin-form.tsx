'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiClientError } from '@/lib/client/api';
import { Badge, Button, Card, ErrorText, inputBase } from './ui';

export function KioskPinForm({ pinSet }: { pinSet: boolean }) {
  const router = useRouter();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save(value: string | null) {
    setError(null);
    try {
      await api('/api/settings', { method: 'PATCH', body: { kioskExitPin: value } });
      setPin('');
      setNotice(
        value
          ? 'PIN saved. Displays pick it up with their next heartbeat.'
          : 'PIN removed. The exit menu now opens without one.',
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.detail : String(err));
    }
  }

  return (
    <Card
      title="Kiosk exit menu"
      actions={<Badge tone={pinSet ? 'green' : 'amber'}>{pinSet ? 'PIN set' : 'No PIN'}</Badge>}
    >
      <p className="mb-3 text-sm text-neutral-600">
        On a display, press and hold the top-left corner for 3 seconds to open the exit menu (choose
        another Home app, open Android settings, leave strict mode, reload).{' '}
        {pinSet ? 'It asks for this PIN.' : 'Without a PIN, anyone at the display can open it.'}
      </p>
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void save(pin);
        }}
      >
        <input
          className={`${inputBase} w-40 font-mono tracking-widest`}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d{4,8}"
          placeholder="4-8 digits"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, '').slice(0, 8));
            setNotice(null);
          }}
        />
        <Button type="submit" variant="primary" disabled={pin.length < 4}>
          {pinSet ? 'Change PIN' : 'Set PIN'}
        </Button>
        {pinSet && (
          <Button variant="ghost" onClick={() => save(null)}>
            Remove PIN
          </Button>
        )}
        {notice && <span className="text-sm text-neutral-600">{notice}</span>}
      </form>
      <ErrorText>{error}</ErrorText>
      <p className="mt-3 text-xs text-neutral-500">
        A convenience lock against passers-by: displays store a salted hash so the menu works
        offline, but a short PIN is not strong security.
      </p>
    </Card>
  );
}
