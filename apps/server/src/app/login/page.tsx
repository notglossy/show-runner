import { Logo } from '@/components/logo';

import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const target =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <div className="bg-ground grid min-h-screen grid-rows-[auto_1fr] md:grid-cols-[5fr_4fr] md:grid-rows-none">
      <section className="bg-ink relative flex flex-col justify-between gap-7 overflow-hidden px-4 py-6 md:p-12">
        <Logo tone="dark" className="h-6 w-auto self-start md:h-7" />
        <p className="max-w-xl text-3xl leading-[1.02] font-medium tracking-tight text-white md:text-5xl lg:text-6xl">
          Every screen in the house, from one dashboard.
        </p>
        {/* A display outline running off the panel edge, echoing the logo's screen mark. */}
        <div
          aria-hidden="true"
          className="border-signal absolute right-[-60px] bottom-30 hidden h-55 w-85 border-[3px] md:block"
        >
          <div className="border-signal absolute -bottom-9 left-1/2 w-30 -translate-x-1/2 border-t-[3px]" />
        </div>
        <p className="label-mono text-concrete hidden md:block">Self-hosted</p>
      </section>
      <main className="flex items-start justify-center px-4 py-8 md:items-center md:p-12">
        <div className="w-full max-w-sm">
          <h1 className="mb-7 text-3xl leading-none font-medium tracking-tight">Sign in</h1>
          <LoginForm next={target} />
        </div>
      </main>
    </div>
  );
}
