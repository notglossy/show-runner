import { randomUUID } from 'node:crypto';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { PREVIOUS_TOKEN_GRACE_MS, registerDevice } from '@/lib/devices/service';

import { ADMIN_SESSION_MS, createAdminSession, isAdminRequest, verifyAdminSession } from './admin';
import { randomPairingCode, safeEqual } from './crypto';
import { requireDevice, requireDeviceOrAdmin, requireSharedSecret } from './device';

const req = (headers: Record<string, string> = {}) =>
  new Request('http://kiosk.local/x', { headers });

describe('admin auth', () => {
  it('accepts a fresh session, rejects tampered or expired ones', () => {
    const now = Date.now();
    const { value } = createAdminSession(now);
    expect(verifyAdminSession(value, now)).toBe(true);
    expect(
      verifyAdminSession(
        value.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')),
        now,
      ),
    ).toBe(false);
    expect(verifyAdminSession(value, now + ADMIN_SESSION_MS + 1)).toBe(false);
    expect(verifyAdminSession(`v1.${now + 10 ** 9}.deadbeef`, now)).toBe(false);
    expect(verifyAdminSession(undefined)).toBe(false);
  });

  it('recognises the session cookie or the Bearer password', () => {
    const { value } = createAdminSession();
    expect(
      isAdminRequest(req({ cookie: `other=1; showrunner_admin=${encodeURIComponent(value)}` })),
    ).toBe(true);
    expect(isAdminRequest(req({ authorization: 'Bearer test-admin-password' }))).toBe(true);
    expect(isAdminRequest(req({ authorization: 'Bearer wrong' }))).toBe(false);
    expect(isAdminRequest(req())).toBe(false);
  });
});

describe('device auth', () => {
  const register = () =>
    registerDevice(
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

  it('requires the shared secret header for registration', () => {
    expect(() => requireSharedSecret(req())).toThrow(/x-kiosk-secret/);
    expect(() => requireSharedSecret(req({ 'x-kiosk-secret': 'nope' }))).toThrow();
    expect(() =>
      requireSharedSecret(req({ 'x-kiosk-secret': 'test-device-secret' })),
    ).not.toThrow();
  });

  it('accepts the device token via Bearer or cookie, only for its own device', () => {
    const a = register();
    const b = register();
    expect(
      requireDeviceOrAdmin(req({ authorization: `Bearer ${a.token}` }), a.device.id).kind,
    ).toBe('device');
    expect(
      requireDeviceOrAdmin(
        req({ cookie: `showrunner_device=${a.device.id}.${a.token}` }),
        a.device.id,
      ).kind,
    ).toBe('device');
    expect(() =>
      requireDeviceOrAdmin(req({ authorization: `Bearer ${a.token}` }), b.device.id),
    ).toThrow(/token/);
    expect(() =>
      requireDeviceOrAdmin(
        req({ cookie: `showrunner_device=${b.device.id}.${a.token}` }),
        b.device.id,
      ),
    ).toThrow();
  });

  afterEach(() => vi.useRealTimers());

  it('keeps the previous token valid for a grace period after re-registration, then rejects it', () => {
    vi.useFakeTimers();
    const reRegister = (id: string) =>
      registerDevice(
        {
          deviceId: id,
          model: 'm',
          androidVersion: '11',
          appVersion: '1',
          screenWidth: 1280,
          screenHeight: 800,
        },
        null,
      );
    const first = register();
    const second = reRegister(first.device.id);
    const bearer = (t: string) => req({ authorization: `Bearer ${t}` });

    // A silently retried registration: the device may hold either token.
    expect(requireDevice(bearer(first.token), first.device.id).id).toBe(first.device.id);
    expect(requireDevice(bearer(second.token), first.device.id).id).toBe(first.device.id);

    vi.advanceTimersByTime(PREVIOUS_TOKEN_GRACE_MS + 1);
    expect(() => requireDevice(bearer(first.token), first.device.id)).toThrow();
    expect(requireDevice(bearer(second.token), first.device.id).id).toBe(first.device.id);

    // Only one previous token is honoured: after another rotation the first token is gone for good.
    const third = reRegister(first.device.id);
    expect(() => requireDevice(bearer(first.token), first.device.id)).toThrow();
    expect(requireDevice(bearer(second.token), first.device.id).id).toBe(first.device.id);
    expect(requireDevice(bearer(third.token), first.device.id).id).toBe(first.device.id);
  });

  it('lets admins view any device but not act as one; hides unknown devices from non-admins', () => {
    const a = register();
    const admin = req({ authorization: 'Bearer test-admin-password' });
    expect(requireDeviceOrAdmin(admin, a.device.id).kind).toBe('admin');
    expect(() => requireDevice(admin, a.device.id)).toThrow(/Only the device/);
    expect(() => requireDeviceOrAdmin(admin, 'missing')).toThrow(/not found/);
    expect(() => requireDeviceOrAdmin(req(), 'missing')).toThrow(/token/);
  });
});

describe('crypto helpers', () => {
  it('generates readable pairing codes and compares safely', () => {
    for (let i = 0; i < 200; i++) expect(randomPairingCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abcd')).toBe(false);
  });
});
