export interface User {
  id: string
  email: string
  role?: 'user' | 'admin'
}

export interface TotpAccount {
  id: string
  issuer: string
  accountName: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
  createdAt: number
  secret: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface MeResponse {
  user: User
}

export interface SecretsResponse {
  items: TotpAccount[]
}

export interface AdminUser {
  id: string
  email: string
  role: 'user' | 'admin'
  createdAt: number
  secretCount: number
}

export interface AdminUserListResponse {
  users: AdminUser[]
}

export interface AdminCreateUserResponse {
  user: { id: string; email: string; role: 'user' | 'admin' }
}

export interface AdminSecret {
  id: string
  issuer: string
  accountName: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
  createdAt: number
  currentCode: string
  remainingSeconds: number
}

export interface AdminUserSecretsResponse {
  items: AdminSecret[]
}

export interface ApiError {
  error: string
}
