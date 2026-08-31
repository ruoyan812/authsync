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
