import { parseJson, route, unauthorized } from '@/lib/api/http';
import { isSecureRequest } from '@/lib/api/request';
import { LoginRequestSchema } from '@/lib/api/schemas';
import { adminCookieHeader, checkAdminPassword, createAdminSession } from '@/lib/auth/admin';

export const POST = route(async (req) => {
  const { password } = await parseJson(req, LoginRequestSchema);
  if (!checkAdminPassword(password)) {
    await new Promise((r) => setTimeout(r, 500)); // slow down guessing
    throw unauthorized('Incorrect password');
  }
  const session = createAdminSession();
  return Response.json(
    { ok: true, expiresAt: session.expiresAt.toISOString() },
    {
      headers: {
        'set-cookie': adminCookieHeader(session.value, session.expiresAt, isSecureRequest(req)),
      },
    },
  );
});
