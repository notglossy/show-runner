/** Best-effort client IP from proxy headers (Next's server sets x-forwarded-for). */
export function clientIp(req: Request): string | null {
  const forwarded = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || req.headers.get("x-real-ip") || null;
  return ip?.replace(/^::ffff:/, "") ?? null;
}

/** Whether the original request came in over HTTPS (directly or via a TLS-terminating proxy). */
export function isSecureRequest(req: Request): boolean {
  return req.headers.get("x-forwarded-proto") === "https" || new URL(req.url).protocol === "https:";
}
