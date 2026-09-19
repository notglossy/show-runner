import { ApiError, parseJson, route } from '@/lib/api/http';
import { GenerateScreenRequestSchema } from '@/lib/api/schemas';
import { AiProviderError } from '@/lib/ai/client';
import { generateScreen, type GenerateEvent } from '@/lib/ai/generate';
import { requireAdmin } from '@/lib/auth/admin';
import { env } from '@/lib/env';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

/**
 * Streams newline-delimited JSON GenerateEvents: status/progress while the model works, then one
 * `result` (html + remaining problems) or `error`. Nothing is saved; the editor decides.
 */
export const POST = route(async (req) => {
  requireAdmin(req);
  const config = env();
  if (!config.AI_API_KEY) {
    throw new ApiError(
      503,
      'not_configured',
      'AI generation is not configured: set AI_API_KEY (and optionally AI_BASE_URL, AI_MODEL).',
    );
  }
  const request = await parseJson(req, GenerateScreenRequestSchema, 600 * 1024);
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: GenerateEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // client went away
        }
      };
      try {
        await generateScreen(
          request,
          { baseUrl: config.AI_BASE_URL, apiKey: config.AI_API_KEY!, model: config.AI_MODEL },
          emit,
          {
            signal: req.signal,
          },
        );
      } catch (err) {
        if (!req.signal.aborted) {
          console.error('[ai] generation failed', err);
          emit({
            type: 'error',
            message:
              err instanceof AiProviderError || err instanceof Error ? err.message : String(err),
          });
        }
      } finally {
        try {
          controller.close();
        } catch {
          // already closed
        }
      }
    },
  });

  return new Response(stream, {
    headers: {
      'content-type': 'application/x-ndjson; charset=utf-8',
      'cache-control': 'no-cache, no-transform',
      'x-accel-buffering': 'no',
    },
  });
});
