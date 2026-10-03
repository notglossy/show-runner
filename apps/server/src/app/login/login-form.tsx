'use client';

import { useState } from 'react';

export function LoginForm({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const password = new FormData(event.currentTarget).get('password');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      window.location.assign(next);
      return;
    }
    const body = await res.json().catch(() => null);
    setError(body?.error?.message ?? 'Login failed');
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="label-mono text-ink" htmlFor="password">
        Admin password
      </label>
      <input
        id="password"
        name="password"
        type="password"
        autoFocus
        required
        className="border-ink h-10 rounded border bg-white px-3 text-sm"
      />
      {error && <p className="text-danger text-sm">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="label-mono bg-signal hover:bg-ink hover:text-signal-tint h-10 rounded px-5 text-white disabled:opacity-50"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
