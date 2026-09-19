import { randomUUID } from 'node:crypto';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sha256 } from '@/lib/auth/crypto';
import { type KioskEvent, subscribe } from '@/lib/events/bus';
import { stopScheduler } from '@/lib/playlists/scheduler';
import { createPlaylist, deletePlaylist, updatePlaylist } from '@/lib/playlists/service';
import { createScreen, deleteScreen, findScreen, updateScreen } from '@/lib/screens/service';

import {
  appendLog,
  applyAssignment,
  claimDevice,
  DEFAULT_SCREEN_ID,
  getDeviceOr404,
  listLogs,
  recordHeartbeat,
  registerDevice,
  sendCommand,
  toDeviceView,
} from './service';

const reg = (deviceId: string = randomUUID()) =>
  registerDevice(
    {
      deviceId,
      model: 'Echo_Show_8',
      androidVersion: '11',
      appVersion: '0.1.0',
      screenWidth: 1280,
      screenHeight: 800,
    },
    '192.168.1.203',
  );

function listen(deviceId: string) {
  const events: KioskEvent[] = [];
  const off = subscribe(deviceId, 'device', (e) => events.push(e));
  return { events, off };
}

const screen = (name: string) => createScreen({ name, html: `<p>${name}</p>` });

beforeEach(() => {
  if (!findScreen(DEFAULT_SCREEN_ID))
    createScreen({ id: DEFAULT_SCREEN_ID, name: 'Clock', html: '<p>clock</p>', source: 'builtin' });
});
afterEach(() => {
  stopScheduler();
  vi.useRealTimers();
});

describe('registration', () => {
  it('creates an unclaimed device with a pairing code and hashed token', () => {
    const { device, token } = reg();
    expect(device.pairingCode).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    expect(device.claimedAt).toBeNull();
    expect(device.tokenHash).toBe(sha256(token));
    expect(toDeviceView(device)).not.toHaveProperty('tokenHash');
  });

  it('re-registration rotates the token but keeps the pairing code while unclaimed', () => {
    const first = reg();
    const second = reg(first.device.id);
    expect(second.token).not.toBe(first.token);
    expect(second.device.pairingCode).toBe(first.device.pairingCode);
  });
});

describe('claim + assignment', () => {
  it('claims by pairing code, assigns the default screen, and tells the device to navigate', () => {
    const { device } = reg();
    const { events, off } = listen(device.id);
    const claimed = claimDevice({ pairingCode: device.pairingCode!, name: 'Kitchen' });
    off();
    expect(claimed).toMatchObject({
      name: 'Kitchen',
      pairingCode: null,
      assignmentType: 'screen',
      currentScreenId: DEFAULT_SCREEN_ID,
    });
    expect(events).toContainEqual({ type: 'navigate', screenId: DEFAULT_SCREEN_ID });
    // pairing code no longer works, and re-registering a claimed device doesn't issue a new one
    expect(() => claimDevice({ pairingCode: device.pairingCode!, name: 'x' })).toThrow(/not found/);
    expect(reg(device.id).device.pairingCode).toBeNull();
  });

  it('switching screens publishes navigate; editing the shown screen publishes reload', () => {
    const { device } = reg();
    claimDevice({ pairingCode: device.pairingCode!, name: 'Den' });
    const other = screen('Other');
    const { events, off } = listen(device.id);
    applyAssignment(device.id, { type: 'screen', screenId: other.id });
    updateScreen(other.id, { html: '<p>v2</p>' });
    off();
    expect(events).toEqual([{ type: 'navigate', screenId: other.id }, { type: 'reload' }]);
  });

  it('refuses to delete a screen that is assigned or in a playlist', () => {
    const { device } = reg();
    claimDevice({ pairingCode: device.pairingCode!, name: 'Hall' });
    const s = screen('Busy');
    applyAssignment(device.id, { type: 'screen', screenId: s.id });
    expect(() => deleteScreen(s.id)).toThrow(/in use by device "Hall"/);
    applyAssignment(device.id, { type: 'none' });
    const p = createPlaylist({ name: 'Uses busy', items: [{ screenId: s.id, dwellSeconds: 10 }] });
    expect(() => deleteScreen(s.id)).toThrow(/playlist "Uses busy"/);
    deletePlaylist(p.id);
    expect(() => deleteScreen(s.id)).not.toThrow();
  });
});

describe('playlist rotation', () => {
  it('rotates through items on their dwell times and wraps around', () => {
    vi.useFakeTimers();
    const { device } = reg();
    claimDevice({ pairingCode: device.pairingCode!, name: 'Office' });
    const a = screen('A');
    const b = screen('B');
    const p = createPlaylist({
      name: 'AB',
      items: [
        { screenId: a.id, dwellSeconds: 10 },
        { screenId: b.id, dwellSeconds: 20 },
      ],
    });
    const { events, off } = listen(device.id);

    applyAssignment(device.id, { type: 'playlist', playlistId: p.id });
    expect(getDeviceOr404(device.id).currentScreenId).toBe(a.id);
    vi.advanceTimersByTime(10_000);
    expect(getDeviceOr404(device.id).currentScreenId).toBe(b.id);
    vi.advanceTimersByTime(19_000);
    expect(getDeviceOr404(device.id).currentScreenId).toBe(b.id);
    vi.advanceTimersByTime(1_000);
    expect(getDeviceOr404(device.id).currentScreenId).toBe(a.id);
    off();
    expect(
      events.filter((e) => e.type === 'navigate').map((e) => 'screenId' in e && e.screenId),
    ).toEqual([a.id, b.id, a.id]);
  });

  it('re-syncs when items change and unassigns when the playlist is deleted', () => {
    vi.useFakeTimers();
    const { device } = reg();
    claimDevice({ pairingCode: device.pairingCode!, name: 'Garage' });
    const a = screen('A2');
    const b = screen('B2');
    const p = createPlaylist({
      name: 'P',
      items: [
        { screenId: a.id, dwellSeconds: 10 },
        { screenId: b.id, dwellSeconds: 10 },
      ],
    });
    applyAssignment(device.id, { type: 'playlist', playlistId: p.id });
    vi.advanceTimersByTime(10_000);
    expect(getDeviceOr404(device.id).playlistPosition).toBe(1);

    updatePlaylist(p.id, { items: [{ screenId: b.id, dwellSeconds: 10 }] });
    expect(getDeviceOr404(device.id)).toMatchObject({ playlistPosition: 0, currentScreenId: b.id });

    deletePlaylist(p.id);
    expect(getDeviceOr404(device.id)).toMatchObject({
      assignmentType: 'none',
      currentScreenId: null,
      playlistId: null,
    });
  });

  it('manual navigate within a playlist restarts the dwell timer', () => {
    vi.useFakeTimers();
    const { device } = reg();
    claimDevice({ pairingCode: device.pairingCode!, name: 'Porch' });
    const a = screen('A3');
    const b = screen('B3');
    const c = screen('C3');
    const p = createPlaylist({
      name: 'P3',
      items: [
        { screenId: a.id, dwellSeconds: 10 },
        { screenId: b.id, dwellSeconds: 10 },
      ],
    });
    applyAssignment(device.id, { type: 'playlist', playlistId: p.id });
    vi.advanceTimersByTime(9_000);
    sendCommand(getDeviceOr404(device.id), { type: 'navigate', screenId: c.id });
    expect(getDeviceOr404(device.id).currentScreenId).toBe(c.id);
    vi.advanceTimersByTime(9_000);
    expect(getDeviceOr404(device.id).currentScreenId).toBe(c.id);
    vi.advanceTimersByTime(1_000);
    expect(getDeviceOr404(device.id).currentScreenId).toBe(b.id);
  });
});

describe('heartbeat + logs', () => {
  it('records status and last seen, making the device online', () => {
    const { device } = reg();
    expect(toDeviceView(device).online).toBe(false);
    const updated = recordHeartbeat(
      device,
      { battery: { level: 90, charging: true }, wifi: { rssi: -60, ssid: 'home' } },
      '10.0.0.2',
    );
    expect(updated.status.battery).toEqual({ level: 90, charging: true });
    expect(toDeviceView(updated).online).toBe(true);
    expect(updated.lastIp).toBe('10.0.0.2');
  });

  it('stores logs newest first, paginates, and rate-limits bursts', () => {
    const { device } = reg();
    const accepted = Array.from({ length: 65 }, (_, i) =>
      appendLog(device, { message: `err ${i}`, level: 'error' }, 'UA'),
    );
    expect(accepted.filter(Boolean)).toHaveLength(60);
    const page = listLogs(device.id, { limit: 10 });
    expect(page[0]?.message).toBe('err 59');
    expect(page[0]?.context.userAgent).toBe('UA');
    const next = listLogs(device.id, { limit: 10, before: page.at(-1)!.id });
    expect(next[0]?.message).toBe('err 49');
  });
});
