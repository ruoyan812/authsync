/**
 * 基于 Web Crypto API 的密码学工具集（Cloudflare Workers 运行时兼容）
 * - AES-256-GCM：加密存储 2FA 密钥
 * - PBKDF2-SHA256：密码哈希
 * - HMAC-SHA256：JWT 签名与校验
 */

const encoder = new TextEncoder()
const decoder = new TextDecoder()

function toBase64Url(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(value: string): Uint8Array {
  const b64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** 十六进制字符串转字节（截取前 32 字节作为 AES-256 密钥） */
function fromHex(hex: string): Uint8Array {
  const clean = hex.trim().replace(/^0x/, '')
  const bytes = new Uint8Array(Math.floor(clean.length / 2))
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes.subarray(0, 32)
}

function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length))
}

// ────────────────────────── AES-256-GCM ──────────────────────────

/** 加密字符串，返回 "iv:密文(含认证标签)" 的 Base64URL 格式 */
export async function encryptSecret(plaintext: string, masterKey: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', fromHex(masterKey), { name: 'AES-GCM' }, false, [
    'encrypt',
  ])
  const iv = randomBytes(12)
  // Web Crypto 的 GCM 密文末尾已附带 16 字节认证标签
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(plaintext))
  return `${toBase64Url(iv)}:${toBase64Url(new Uint8Array(cipher))}`
}

/** 解密 encryptSecret 生成的字符串，失败时抛出异常 */
export async function decryptSecret(payload: string, masterKey: string): Promise<string> {
  const [ivPart, cipherPart] = payload.split(':')
  if (!ivPart || !cipherPart) throw new Error('密文格式无效')
  const key = await crypto.subtle.importKey('raw', fromHex(masterKey), { name: 'AES-GCM' }, false, [
    'decrypt',
  ])
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromBase64Url(ivPart) },
    key,
    fromBase64Url(cipherPart),
  )
  return decoder.decode(plain)
}

// ────────────────────────── PBKDF2 密码哈希 ──────────────────────────

/** 生成密码哈希，格式 "迭代次数:盐:哈希" */
export async function hashPassword(password: string, iterations: number): Promise<string> {
  const salt = randomBytes(16)
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return `${iterations}:${toBase64Url(salt)}:${toBase64Url(new Uint8Array(bits))}`
}

/** 校验密码，迭代次数从存储的哈希中读取以便后续平滑升级 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':')
  if (parts.length !== 3) return false
  const iterations = Number(parts[0])
  if (!Number.isFinite(iterations) || iterations <= 0) return false

  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: fromBase64Url(parts[1]!), iterations, hash: 'SHA-256' },
    key,
    256,
  )
  return toBase64Url(new Uint8Array(bits)) === parts[2]
}

// ────────────────────────── JWT (HS256) ──────────────────────────

async function hmacKey(secret: string, usage: ('sign' | 'verify')[]): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    usage,
  )
}

export interface JwtPayload {
  sub: string
  email: string
  iat?: number
  exp?: number
}

/** 签发 JWT，默认 30 天有效 */
export async function signJwt(
  payload: { sub: string; email: string },
  secret: string,
  ttlSeconds = 60 * 60 * 24 * 30,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = toBase64Url(encoder.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = toBase64Url(
    encoder.encode(JSON.stringify({ ...payload, iat: now, exp: now + ttlSeconds })),
  )
  const data = `${header}.${body}`
  const key = await hmacKey(secret, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data))
  return `${data}.${toBase64Url(new Uint8Array(signature))}`
}

// ────────────────────────── TOTP 生成（服务端计算当前验证码） ──────────────────────────

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const TOTP_HASH: Record<string, string> = {
  SHA1: 'SHA-1',
  SHA256: 'SHA-256',
  SHA512: 'SHA-512',
}

/** Base32 解码（忽略空格与等号填充，自动转大写） */
function base32Decode(input: string): Uint8Array {
  const clean = input.replace(/=+$/, '').toUpperCase().replace(/\s+/g, '')
  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return new Uint8Array(bytes)
}

/**
 * 按 RFC 6238 生成指定时间点的 TOTP 验证码。
 * 返回 { code, remainingSeconds }，remainingSeconds 为距离下次刷新的剩余秒数。
 */
export async function generateTotp(
  secretBase32: string,
  algorithm = 'SHA1',
  digits = 6,
  period = 30,
  atTime = Date.now(),
): Promise<{ code: string; remainingSeconds: number }> {
  const counter = Math.floor(atTime / 1000 / period)
  const counterBytes = new Uint8Array(8)
  let tmp = counter
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = tmp & 0xff
    tmp = Math.floor(tmp / 256)
  }

  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secretBase32),
    { name: 'HMAC', hash: TOTP_HASH[algorithm] ?? 'SHA-1' },
    false,
    ['sign'],
  )
  const hmac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes))
  const offset = hmac[hmac.length - 1]! & 0x0f
  const binary =
    ((hmac[offset]! & 0x7f) << 24) |
    ((hmac[offset + 1]! & 0xff) << 16) |
    ((hmac[offset + 2]! & 0xff) << 8) |
    (hmac[offset + 3]! & 0xff)
  const code = (binary % 10 ** digits).toString().padStart(digits, '0')
  const remainingSeconds = period - (Math.floor(atTime / 1000) % period)
  return { code, remainingSeconds }
}

/** 校验 JWT，失败返回 null */
export async function verifyJwt(token: string, secret: string): Promise<JwtPayload | null> {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [header, body, signature] = parts as [string, string, string]
  try {
    const key = await hmacKey(secret, ['verify'])
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      fromBase64Url(signature),
      encoder.encode(`${header}.${body}`),
    )
    if (!valid) return null

    const payload = JSON.parse(decoder.decode(fromBase64Url(body))) as JwtPayload
    if (typeof payload.exp === 'number' && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}
