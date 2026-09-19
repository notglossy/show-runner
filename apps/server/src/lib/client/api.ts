import type { ApiErrorBody, ApiIssue } from '@/lib/api/http';

/** Typed error for a failed admin API call, carrying HTTP `status`, `code`, and field issues. */
export class ApiClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly issues: ApiIssue[] = [],
  ) {
    super(message);
  }

  /** Message plus field issues, for showing in a form. */
  get detail(): string {
    return this.issues.length
      ? `${this.message}: ${this.issues.map((i) => `${i.path || 'body'} ${i.message}`).join('; ')}`
      : this.message;
  }
}

/** JSON fetch against the admin API from client components. Redirects to /login on 401. */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: init.method ?? (init.body === undefined ? 'GET' : 'POST'),
    headers: init.body === undefined ? undefined : { 'content-type': 'application/json' },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    cache: 'no-store',
  });
  if (res.status === 401) {
    // Full reload on purpose: the session is gone, so drop all client state.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?next=${encodeURIComponent(window.location.pathname)}`);
    throw new ApiClientError(401, 'unauthorized', 'Session expired');
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiClientError(
      res.status,
      err?.code ?? 'error',
      err?.message ?? `HTTP ${res.status}`,
      err?.issues,
    );
  }
  return body as T;
}
