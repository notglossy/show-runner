import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, verifyAdminSession } from "./admin";

/** For server components/pages: redirects to /login unless the admin session cookie is valid. */
export async function requireAdminPage(next: string): Promise<void> {
  const store = await cookies();
  if (!verifyAdminSession(store.get(ADMIN_COOKIE)?.value)) {
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
}
