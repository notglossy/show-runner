import { LoginForm } from './login-form';

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { next } = await searchParams;
  const target =
    typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/';
  return (
    <main className="mx-auto mt-24 max-w-sm p-6">
      <h1 className="mb-8 text-4xl leading-none font-medium tracking-tight">ShowRunner</h1>
      <LoginForm next={target} />
    </main>
  );
}
