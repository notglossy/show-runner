import { route } from '@/lib/api/http';
import { requireAdmin } from '@/lib/auth/admin';
import type { Device } from '@/lib/db/schema';
import { buildDataPayload } from '@/lib/providers/payload';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

const PREVIEW_DEVICE: Device = {
  id: '00000000-0000-4000-8000-000000000000',
  name: 'Preview',
  pairingCode: null,
  claimedAt: new Date(0),
  tokenHash: '',
  previousTokenHash: null,
  previousTokenExpiresAt: null,
  model: 'Echo_Show_8',
  androidVersion: '11',
  appVersion: 'preview',
  screenWidth: 1280,
  screenHeight: 800,
  assignmentType: 'none',
  screenId: null,
  playlistId: null,
  currentScreenId: null,
  playlistPosition: 0,
  lastSeenAt: null,
  lastIp: null,
  status: { wifi: { rssi: -52, ssid: 'preview' } },
  registeredAt: new Date(0),
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

/** Live kiosk.data (real time + weather with current settings) for the screen editor preview. */
export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json(await buildDataPayload(PREVIEW_DEVICE, { id: 'preview', name: 'Preview' }), {
    headers: { 'cache-control': 'no-store' },
  });
});
