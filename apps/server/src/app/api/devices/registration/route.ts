import { parseJson, route } from '@/lib/api/http';
import { SetRegistrationRequestSchema } from '@/lib/api/schemas';
import { requireAdmin } from '@/lib/auth/admin';
import {
  closeRegistrationWindow,
  openRegistrationWindow,
  registrationStatus,
} from '@/lib/devices/registration';

// Live state on every request; never prerender.
export const dynamic = 'force-dynamic';

export const GET = route(async (req) => {
  requireAdmin(req);
  return Response.json({ registration: registrationStatus() });
});

/** Opens or closes the registration window. In secret mode the window is irrelevant and this is a no-op. */
export const PUT = route(async (req) => {
  requireAdmin(req);
  const { open } = await parseJson(req, SetRegistrationRequestSchema);
  if (open) openRegistrationWindow();
  else closeRegistrationWindow();
  return Response.json({ registration: registrationStatus() });
});
