import { route } from "@/lib/api/http";
import { clearAdminCookieHeader } from "@/lib/auth/admin";

export const POST = route(async () =>
  Response.json({ ok: true }, { headers: { "set-cookie": clearAdminCookieHeader() } }),
);
