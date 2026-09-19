import { route } from '@/lib/api/http';
import { requireDeviceOrAdmin } from '@/lib/auth/device';
import { findDevice } from '@/lib/devices/service';
import { subscribe, type KioskEvent } from '@/lib/events/bus';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

const KEEPALIVE_MS = 25_000;

/**
 * Server-Sent Events stream of KioskCommands for one device. Sends `hello` (with the screen the
 * server expects the page to be showing) on connect, then commands as they happen, plus comment
 * pings so proxies and the WebView keep the connection open.
 */
export const GET = route(async (req, { params }: RouteContext<'/api/devices/[id]/events'>) => {
  const { id } = await params;
  const viewer = requireDeviceOrAdmin(req, id);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const send = (event: KioskEvent) => write(`data: ${JSON.stringify(event)}\n\n`);

      write('retry: 3000\n\n');
      const unsubscribe = subscribe(id, viewer.kind, send);
      send({
        type: 'hello',
        screenId: findDevice(id)?.currentScreenId ?? null,
        serverTime: Date.now(),
      });
      const ping = setInterval(() => write(`: ping\n\n`), KEEPALIVE_MS);

      cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };
      req.signal.addEventListener('abort', () => cleanup(), { once: true });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    },
  });
});
