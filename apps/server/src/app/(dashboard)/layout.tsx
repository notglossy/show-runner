import { Nav } from '@/components/nav';
import { requireAdminPage } from '@/lib/auth/session';

export default async function DashboardLayout({ children }: LayoutProps<'/'>) {
  // Pages also check (layouts aren't re-run on every client navigation); this guards the shell itself.
  await requireAdminPage('/devices');
  return (
    <div className="bg-ground flex min-h-screen flex-col md:flex-row">
      <Nav />
      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-10">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
