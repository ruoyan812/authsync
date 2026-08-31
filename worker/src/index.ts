import { Hono } from 'hono'
import {
  decryptSecret,
  encryptSecret,
  hashPassword,
  signJwt,
  verifyJwt,
  verifyPassword,
} from './crypto'
import { getDb } from './db'
import type { Env } from './types'

type AppEnv = {
  Bindings: Env
  Variables: { userId: string; email: string }
}

const app = new Hono<AppEnv>()

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BASE32_RE = /^[A-Z2-7]+={0,6}$/i

// 邮箱归一化：去首尾空格 + 转小写，避免注册/登录因大小写或空格无法匹配
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function iterations(env: Env): number {
  const value = Number(env.PBKDF2_ITERATIONS)
  return Number.isFinite(value) && value > 0 ? value : 100_000
}

/** 校验 Bearer 令牌 */
async function requireAuth(c: any, next: any) {
  const header: string = c.req.header('Authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return c.json({ error: '未登录' }, 401)

  const payload = await verifyJwt(token, c.env.JWT_SECRET)
  if (!payload) return c.json({ error: '登录已过期，请重新登录' }, 401)

  c.set('userId', payload.sub)
  c.set('email', payload.email)
  await next()
}

// ────────────────────────── 健康检查 ──────────────────────────

app.get('/api/health', (c) => c.json({ ok: true, service: 'authsync' }))

// ────────────────────────── 认证 ──────────────────────────

app.post('/api/auth/register', async (c) => {
  const { email, password } = (await c.req.json().catch(() => ({}))) as {
    email?: string
    password?: string
  }
  if (!email || !password) return c.json({ error: '请填写邮箱和密码' }, 400)
  const normalizedEmail = normalizeEmail(email)
  if (!EMAIL_RE.test(normalizedEmail)) return c.json({ error: '邮箱格式不正确' }, 400)
  if (password.length < 8) return c.json({ error: '密码至少需要 8 位' }, 400)

  const db = getDb(c.env)
  const existing = await db.execute({
    sql: 'SELECT id FROM users WHERE email = ?',
    args: [normalizedEmail],
  })
  if (existing.rows.length > 0) return c.json({ error: '该邮箱已注册，请直接登录' }, 409)

  const id = crypto.randomUUID()
  const passwordHash = await hashPassword(password, iterations(c.env))
  await db.execute({
    sql: 'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
    args: [id, normalizedEmail, passwordHash, Date.now()],
  })

  const token = await signJwt({ sub: id, email: normalizedEmail }, c.env.JWT_SECRET)
  return c.json({ token, user: { id, email: normalizedEmail } }, 201)
})

app.post('/api/auth/login', async (c) => {
  const { email, password } = (await c.req.json().catch(() => ({}))) as {
    email?: string
    password?: string
  }
  if (!email || !password) return c.json({ error: '请填写邮箱和密码' }, 400)

  const normalizedEmail = normalizeEmail(email)
  const db = getDb(c.env)
  const result = await db.execute({
    sql: 'SELECT id, email, password_hash FROM users WHERE email = ?',
    args: [normalizedEmail],
  })
  const row = result.rows[0]
  if (!row) return c.json({ error: '邮箱或密码错误' }, 401)

  const ok = await verifyPassword(password, String(row.password_hash))
  if (!ok) return c.json({ error: '邮箱或密码错误' }, 401)

  const id = String(row.id)
  const userEmail = String(row.email)
  const token = await signJwt({ sub: id, email: userEmail }, c.env.JWT_SECRET)
  return c.json({ token, user: { id, email: userEmail } })
})

app.get('/api/auth/me', requireAuth, (c) =>
  c.json({ user: { id: c.get('userId'), email: c.get('email') } }),
)

// ────────────────────────── 2FA 密钥 ──────────────────────────

app.use('/api/secrets', requireAuth)
app.use('/api/secrets/*', requireAuth)

app.get('/api/secrets', async (c) => {
  const db = getDb(c.env)
  const result = await db.execute({
    sql: `SELECT id, issuer, account_name, secret_enc, algorithm, digits, period, created_at
          FROM totp_secrets WHERE user_id = ? ORDER BY created_at ASC`,
    args: [c.get('userId')],
  })

  const items = result.rows.map((row) => ({
    id: String(row.id),
    issuer: String(row.issuer ?? ''),
    accountName: String(row.account_name ?? ''),
    algorithm: String(row.algorithm ?? 'SHA1'),
    digits: Number(row.digits ?? 6),
    period: Number(row.period ?? 30),
    createdAt: Number(row.created_at ?? 0),
    // 解密后的密钥供前端本地生成验证码
    secret: '',
  }))

  // 逐条解密（异步无法在 map 中直接完成）
  for (let i = 0; i < items.length; i++) {
    items[i]!.secret = await decryptSecret(String(result.rows[i]!.secret_enc), c.env.MASTER_KEY)
  }

  return c.json({ items })
})

app.post('/api/secrets', async (c) => {
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
  const issuer = String(body.issuer ?? '').trim()
  const accountName = String(body.accountName ?? '').trim()
  const secret = String(body.secret ?? '').replace(/\s+/g, '').toUpperCase()
  const algorithm = String(body.algorithm ?? 'SHA1').toUpperCase()
  const digits = Number(body.digits ?? 6)
  const period = Number(body.period ?? 30)

  if (!BASE32_RE.test(secret)) return c.json({ error: '密钥格式不正确（应为 Base32）' }, 400)
  if (!accountName) return c.json({ error: '请填写账户名称' }, 400)
  if (!['SHA1', 'SHA256', 'SHA512'].includes(algorithm)) return c.json({ error: '不支持的算法' }, 400)

  const id = crypto.randomUUID()
  const createdAt = Date.now()
  const db = getDb(c.env)
  await db.execute({
    sql: `INSERT INTO totp_secrets (id, user_id, issuer, account_name, secret_enc, algorithm, digits, period, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      id,
      c.get('userId'),
      issuer,
      accountName,
      await encryptSecret(secret, c.env.MASTER_KEY),
      algorithm,
      digits,
      period,
      createdAt,
    ],
  })

  return c.json(
    {
      item: { id, issuer, accountName, algorithm, digits, period, createdAt, secret },
    },
    201,
  )
})

app.delete('/api/secrets/:id', async (c) => {
  const db = getDb(c.env)
  const result = await db.execute({
    sql: 'DELETE FROM totp_secrets WHERE id = ? AND user_id = ?',
    args: [c.req.param('id'), c.get('userId')],
  })
  if (result.rowsAffected === 0) return c.json({ error: '未找到该账户' }, 404)
  return c.json({ ok: true })
})

// ────────────────────────── 错误处理 ──────────────────────────

app.notFound((c) => c.env.ASSETS.fetch(c.req.raw))

app.onError((err, c) => {
  console.error('[authsync:error]', err?.message, err?.stack)
  return c.json({ error: '服务器内部错误', detail: err?.message ?? String(err) }, 500)
})

export default app
