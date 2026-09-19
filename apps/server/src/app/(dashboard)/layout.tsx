import { Nav } from '@/components/nav';
import { requireAdminPage } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  // Pages also check (layouts aren't re-run on every client navigation); this guards the shell itself.
  await requireAdminPage('/devices');
  return (
    <div className="min-h-screen bg-neutral-50">
      <Nav />
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
