import { ApiError, route, validate } from "@/lib/api/http";
import { GeocodeQuerySchema } from "@/lib/api/schemas";
import { requireAdmin } from "@/lib/auth/admin";
import { geocode } from "@/lib/settings/geocode";

/** Place search for the settings page (Open-Meteo geocoding). */
export const GET = route(async (req) => {
  requireAdmin(req);
  const { q } = validate(GeocodeQuerySchema, Object.fromEntries(req.nextUrl.searchParams));
  try {
    return Response.json({ results: await geocode(q) });
  } catch (err) {
    throw new ApiError(502, "upstream_failed", `Place search failed: ${err instanceof Error ? err.message : err}`);
  }
});
