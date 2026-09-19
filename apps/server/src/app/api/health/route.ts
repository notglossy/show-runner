export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ ok: true, service: 'showrunner', time: new Date().toISOString() });
}
