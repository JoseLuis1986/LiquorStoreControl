/** Misma origen que la página. En el teléfono pasa por el proxy de Vite y no apunta a localhost del móvil. */
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1';

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    tenantId: string;
    email: string;
    fullName: string;
    role: string;
    customerId?: string | null;
  };
  tenant: { id: string; name: string; slug: string };
};

const STORAGE_KEY = 'liquorcontrol.session';

export function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthSession | null) {
  if (!session) localStorage.removeItem(STORAGE_KEY);
  else localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    const msg =
      typeof body === 'object' && body && 'message' in body
        ? Array.isArray((body as { message: unknown }).message)
          ? ((body as { message: string[] }).message).join(', ')
          : String((body as { message: string }).message)
        : `HTTP ${status}`;
    super(msg);
    this.status = status;
    this.body = body;
  }
}

export async function api<T>(
  path: string,
  opts: RequestInit & { token?: string | null; idempotencyKey?: string } = {},
): Promise<T> {
  const headers = new Headers(opts.headers);
  headers.set('Content-Type', 'application/json');
  if (opts.token) headers.set('Authorization', `Bearer ${opts.token}`);
  if (opts.idempotencyKey) {
    headers.set('Idempotency-Key', opts.idempotencyKey);
  }
  const res = await fetch(`${API_BASE}${path}`, { ...opts, headers });
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, body);
  return body as T;
}
