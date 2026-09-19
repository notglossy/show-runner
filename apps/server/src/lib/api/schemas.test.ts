import { describe, expect, it } from 'vitest';

import * as S from './schemas';

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(true);
const bad = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(false);

describe('request schemas', () => {
  it('register', () => {
    const base = {
      deviceId: '3f2b7c1e-8a4d-4e6f-9b0a-1c2d3e4f5a6b',
      model: 'Echo_Show_8',
      androidVersion: '11',
      appVersion: '0.1.0',
      screenWidth: 1280,
      screenHeight: 800,
    };
    ok(S.RegisterDeviceRequestSchema, base);
    bad(S.RegisterDeviceRequestSchema, { ...base, deviceId: 'not-a-uuid' });
    bad(S.RegisterDeviceRequestSchema, { ...base, screenWidth: 12.5 });
    bad(S.RegisterDeviceRequestSchema, { ...base, screenWidth: 0 });
    bad(S.RegisterDeviceRequestSchema, { ...base, model: '' });
  });
  it('heartbeat', () => {
    ok(S.HeartbeatRequestSchema, {});
    ok(S.HeartbeatRequestSchema, { battery: null, wifi: null });
    ok(S.HeartbeatRequestSchema, {
      battery: { level: 80, charging: true },
      wifi: { rssi: -55, ssid: 'home' },
      uptimeSeconds: 10,
    });
    bad(S.HeartbeatRequestSchema, { battery: { level: 101, charging: true } });
    bad(S.HeartbeatRequestSchema, { wifi: { rssi: 5 } });
  });
  it('log defaults level to error', () => {
    expect(S.DeviceLogRequestSchema.parse({ message: 'boom' }).level).toBe('error');
    bad(S.DeviceLogRequestSchema, { message: '' });
    bad(S.DeviceLogRequestSchema, { message: 'x', level: 'debug' });
  });
  it('claim trims and uppercases the pairing code', () => {
    const parsed = S.ClaimDeviceRequestSchema.parse({
      pairingCode: ' abc234 ',
      name: '  Kitchen ',
    });
    expect(parsed.pairingCode).toBe('ABC234');
    expect(parsed.name).toBe('Kitchen');
    bad(S.ClaimDeviceRequestSchema, { pairingCode: 'ABC23', name: 'x' });
    bad(S.ClaimDeviceRequestSchema, { pairingCode: 'ABC234', name: '   ' });
  });
  it('device update + assignment', () => {
    ok(S.UpdateDeviceRequestSchema, { assignment: { type: 'none' } });
    ok(S.UpdateDeviceRequestSchema, { assignment: { type: 'screen', screenId: 'builtin-clock' } });
    ok(S.UpdateDeviceRequestSchema, { assignment: { type: 'playlist', playlistId: 'p1' } });
    bad(S.UpdateDeviceRequestSchema, { assignment: { type: 'screen' } });
    bad(S.UpdateDeviceRequestSchema, {});
  });
  it('commands', () => {
    ok(S.DeviceCommandRequestSchema, { type: 'reload' });
    ok(S.DeviceCommandRequestSchema, { type: 'navigate', screenId: 's1' });
    bad(S.DeviceCommandRequestSchema, { type: 'navigate' });
    bad(S.DeviceCommandRequestSchema, { type: 'screenshot' });
  });
  it('logs query coerces and defaults', () => {
    expect(S.DeviceLogsQuerySchema.parse({})).toEqual({ limit: 100 });
    expect(S.DeviceLogsQuerySchema.parse({ limit: '20', before: '7' })).toEqual({
      limit: 20,
      before: 7,
    });
    bad(S.DeviceLogsQuerySchema, { limit: '0' });
    bad(S.DeviceLogsQuerySchema, { limit: '501' });
  });
  it('screens', () => {
    const s = S.CreateScreenRequestSchema.parse({ name: ' Clock ', html: '<p/>' });
    expect(s).toMatchObject({
      name: 'Clock',
      description: '',
      dataRefreshSeconds: 60,
      source: 'user',
    });
    bad(S.CreateScreenRequestSchema, { name: 'x', html: '' });
    bad(S.CreateScreenRequestSchema, { name: 'x', html: '<p/>', source: 'builtin' });
    bad(S.CreateScreenRequestSchema, { name: 'x', html: '<p/>', dataRefreshSeconds: 4 });
    ok(S.UpdateScreenRequestSchema, { html: '<p>2</p>' });
    // no defaults on update: a PATCH of html alone must not reset other fields
    expect(S.UpdateScreenRequestSchema.parse({ html: '<p>2</p>' })).toEqual({ html: '<p>2</p>' });
    bad(S.UpdateScreenRequestSchema, {});
  });
  it('playlists', () => {
    expect(S.CreatePlaylistRequestSchema.parse({ name: 'Main' }).items).toEqual([]);
    ok(S.CreatePlaylistRequestSchema, {
      name: 'Main',
      items: [{ screenId: 'a', dwellSeconds: 30 }],
    });
    bad(S.CreatePlaylistRequestSchema, {
      name: 'Main',
      items: [{ screenId: 'a', dwellSeconds: 4 }],
    });
    ok(S.UpdatePlaylistRequestSchema, { items: [] });
    bad(S.UpdatePlaylistRequestSchema, {});
  });
});
