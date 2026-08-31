export interface User {
  id: string
  email: string
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

export interface ApiError {
  error: string
}
