import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { NextRequest } from 'next/server';

import {
  GET as getRegistration,
  PUT as putRegistration,
} from '@/app/api/devices/registration/route';
import { GET as health } from '@/app/api/health/route';
import { resetEnv } from '@/lib/env';

import {
  closeRegistrationWindow,
  openRegistrationWindow,
  REGISTRATION_WINDOW_MS,
  registrationStatus,
  registrationWindowOpen,
} from './registration';
import { claimDevice, registerDevice } from './service';

/** Runs `fn` with the shared secret unset (window mode); test/setup.ts sets one by default. */
function inWindowMode<T>(fn: () => T): T {
  vi.stubEnv('DEVICE_SHARED_SECRET', '');
  resetEnv();
  try {
    return fn();
  } finally {
    vi.unstubAllEnvs();
    resetEnv();
  }
}

async function inWindowModeAsync<T>(fn: () => Promise<T>): Promise<T> {
  vi.stubEnv('DEVICE_SHARED_SECRET', '');
  resetEnv();
  try {
    return await fn();
  } finally {
    vi.unstubAllEnvs();
    resetEnv();
  }
}

afterEach(() => {
  closeRegistrationWindow();
  vi.useRealTimers();
});

describe('registration window', () => {
  it('is closed until opened, then expires after the window length', () => {
    inWindowMode(() => {
      vi.useFakeTimers();
      expect(registrationStatus()).toEqual({ mode: 'window', open: false, closesAt: null });
      const opened = openRegistrationWindow();
      expect(opened.open).toBe(true);
      expect(Date.parse(opened.closesAt!)).toBe(Date.now() + REGISTRATION_WINDOW_MS);
      vi.advanceTimersByTime(REGISTRATION_WINDOW_MS - 1);
      expect(registrationWindowOpen()).toBe(true);
      vi.advanceTimersByTime(2);
      expect(registrationWindowOpen()).toBe(false);
      expect(registrationStatus().closesAt).toBeNull();
    });
  });

  it('closes when a device is claimed', () => {
    inWindowMode(() => {
      openRegistrationWindow();
      const { device } = registerDevice(
        {
          deviceId: randomUUID(),
          model: 'm',
          androidVersion: '11',
          appVersion: '1',
          screenWidth: 1280,
          screenHeight: 800,
        },
        null,
      );
      claimDevice({ pairingCode: device.pairingCode!, name: 'Porch' });
      expect(registrationWindowOpen()).toBe(false);
    });
  });

  it('is read and set over HTTP by admins only', async () => {
    const url = 'http://kiosk.local/api/devices/registration';
    const admin = { authorization: 'Bearer test-admin-password' };
    const put = (open: boolean, headers: Record<string, string> = admin) =>
      putRegistration(
        new NextRequest(url, {
          method: 'PUT',
          headers: { ...headers, 'content-type': 'application/json' },
          body: JSON.stringify({ open }),
        }),
        undefined as never,
      );
    expect((await getRegistration(new NextRequest(url), undefined as never)).status).toBe(401);
    expect((await put(true, {})).status).toBe(401);

    await inWindowModeAsync(async () => {
      const opened = await (await put(true)).json();
      expect(opened.registration).toMatchObject({ mode: 'window', open: true });
      expect(opened.registration.closesAt).not.toBeNull();
      const read = await (
        await getRegistration(new NextRequest(url, { headers: admin }), undefined as never)
      ).json();
      expect(read.registration.open).toBe(true);
      const closed = await (await put(false)).json();
      expect(closed.registration).toEqual({ mode: 'window', open: false, closesAt: null });
    });

    // Secret mode: the window is irrelevant, so opening it changes nothing in the reply.
    const inSecretMode = await (await put(true)).json();
    expect(inSecretMode.registration).toEqual({ mode: 'secret', open: true, closesAt: null });
  });

  it('reports secret mode as always open, and the health endpoint carries the status', async () => {
    expect(registrationStatus()).toEqual({ mode: 'secret', open: true, closesAt: null });
    const body = await health().json();
    expect(body).toMatchObject({ ok: true, registration: { mode: 'secret', open: true } });
    inWindowMode(() => {
      openRegistrationWindow();
      expect(registrationStatus().mode).toBe('window');
    });
  });
});
