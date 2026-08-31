import type { AuthResponse, MeResponse, SecretsResponse, TotpAccount } from '@/types'

const TOKEN_KEY = 'authsync_token'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const res = await fetch(`/api${path}`, { ...options, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `请求失败（${res.status}）`)
  }
  return data as T
}

export const api = {
  register: (email: string, password: string) =>
    request<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<MeResponse>('/auth/me'),

  listSecrets: () => request<SecretsResponse>('/secrets'),

  createSecret: (payload: {
    issuer: string
    accountName: string
    secret: string
    algorithm: string
    digits: number
    period: number
  }) =>
    request<{ item: TotpAccount }>('/secrets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteSecret: (id: string) =>
    request<{ ok: boolean }>(`/secrets/${id}`, { method: 'DELETE' }),
}
