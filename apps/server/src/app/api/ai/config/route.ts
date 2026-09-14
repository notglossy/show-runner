import { route } from "@/lib/api/http";
import { requireAdmin } from "@/lib/auth/admin";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

let modelsCache: { at: number; ids: string[] } | undefined;

/** AI settings the editor needs (never the key), plus model ids from the provider's /models if it has one. */
export const GET = route(async (req) => {
  requireAdmin(req);
  const config = env();
  let models: string[] = [];
  if (config.AI_API_KEY) {
    if (modelsCache && Date.now() - modelsCache.at < 60 * 60_000) {
      models = modelsCache.ids;
    } else {
      try {
        const res = await fetch(`${config.AI_BASE_URL.replace(/\/+$/, "")}/models`, {
          headers: { authorization: `Bearer ${config.AI_API_KEY}` },
          signal: AbortSignal.timeout(8000),
        });
        const body = (await res.json()) as { data?: { id?: string }[] };
        models = (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string").sort();
        modelsCache = { at: Date.now(), ids: models };
      } catch {
        models = [];
      }
    }
  }
  return Response.json({
    configured: Boolean(config.AI_API_KEY),
    defaultModel: config.AI_MODEL,
    provider: new URL(config.AI_BASE_URL).host,
    models,
  });
});
