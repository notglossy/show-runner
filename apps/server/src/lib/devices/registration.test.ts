import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

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
