import { registrationStatus } from '@/lib/devices/registration';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

/** Unauthenticated. Also tells a display's setup flow how it can register here. */
export function GET() {
  return Response.json({
    ok: true,
    service: 'showrunner',
    time: new Date().toISOString(),
    registration: registrationStatus(),
  });
}
