// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true, service: 'showrunner', time: new Date().toISOString() });
}
