import { eq } from 'drizzle-orm';

import type { RegistrationStatus } from '@/lib/api/types';
import { getDb } from '@/lib/db/client';
import { settings } from '@/lib/db/schema';
import { env } from '@/lib/env';

/** How long "Add a display" keeps registration open. Claiming a device closes it early. */
export const REGISTRATION_WINDOW_MS = 10 * 60_000;

const WINDOW_KEY = 'registrationWindow';

interface RegistrationWindow {
  expiresAt: number;
}

/**
 * How new devices get in: `secret` when DEVICE_SHARED_SECRET is set (the header is required and
 * sufficient, any time), otherwise `window` (registration is open only after "Add a display").
 */
export function registrationMode(): RegistrationStatus['mode'] {
  return env().DEVICE_SHARED_SECRET ? 'secret' : 'window';
}

function windowExpiry(): number | null {
  const row = getDb().select().from(settings).where(eq(settings.key, WINDOW_KEY)).get();
  return (row?.value as RegistrationWindow | undefined)?.expiresAt ?? null;
}

/** Whether a device without a token may register right now (window mode only). */
export function registrationWindowOpen(now = Date.now()): boolean {
  const expiresAt = windowExpiry();
  return expiresAt !== null && expiresAt > now;
}

/** Opens (or extends) the registration window for REGISTRATION_WINDOW_MS from now. */
export function openRegistrationWindow(now = Date.now()): RegistrationStatus {
  const value: RegistrationWindow = { expiresAt: now + REGISTRATION_WINDOW_MS };
  getDb()
    .insert(settings)
    .values({ key: WINDOW_KEY, value })
    .onConflictDoUpdate({ target: settings.key, set: { value, updatedAt: new Date() } })
    .run();
  return registrationStatus(now);
}

/** Closes the registration window; a no-op when it is already closed. */
export function closeRegistrationWindow(): void {
  getDb().delete(settings).where(eq(settings.key, WINDOW_KEY)).run();
}

/** Mode plus, in window mode, whether the window is open and until when. */
export function registrationStatus(now = Date.now()): RegistrationStatus {
  if (registrationMode() === 'secret') return { mode: 'secret', open: true, closesAt: null };
  const expiresAt = windowExpiry();
  const open = expiresAt !== null && expiresAt > now;
  return { mode: 'window', open, closesAt: open ? new Date(expiresAt).toISOString() : null };
}
