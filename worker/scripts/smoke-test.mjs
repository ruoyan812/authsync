#!/usr/bin/env node
/**
 * 对已部署的 Worker 做端到端冒烟测试。
 * 用法: node scripts/smoke-test.mjs https://auth.example.com
 */
const BASE = (process.argv[2] || 'http://localhost:8787').replace(/\/$/, '')
const SECRET = 'JBSWY3DPEHPK3PXP'
let failures = 0

function check(name, condition, detail = '') {
  const ok = Boolean(condition)
  if (!ok) failures++
  console.log(`${ok ? '  ✓' : '  ✗'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function call(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { raw: text }
  }
  return { status: res.status, json, text }
}

const email = `smoke${Date.now()}@example.com`
const password = 'password123'

console.log(`\n冒烟测试目标: ${BASE}\n`)

console.log('[1] 健康检查')
const health = await call('/api/health')
check('GET /api/health 返回 200', health.status === 200, `status=${health.status}`)

console.log('\n[2] 注册（含 PBKDF2 口令哈希，验证 CPU 限制）')
const reg = await call('/api/auth/register', { method: 'POST', body: { email, password } })
check('注册成功 (201)', reg.status === 201, `status=${reg.status} ${reg.text.slice(0, 120)}`)
const token = reg.json?.token
check('返回 JWT 令牌', Boolean(token))

console.log('\n[3] 重复注册应被拒绝')
const dup = await call('/api/auth/register', { method: 'POST', body: { email, password } })
check('重复注册返回 409', dup.status === 409, `status=${dup.status}`)

console.log('\n[4] 登录')
const login = await call('/api/auth/login', { method: 'POST', body: { email, password } })
check('登录成功 (200)', login.status === 200, `status=${login.status}`)
const loginToken = login.json?.token
check('登录返回令牌', Boolean(loginToken))

console.log('\n[5] 错误口令应被拒绝')
const badLogin = await call('/api/auth/login', {
  method: 'POST',
  body: { email, password: 'wrongpassword' },
})
check('错误口令返回 401', badLogin.status === 401, `status=${badLogin.status}`)

console.log('\n[6] 未授权访问')
const noAuth = await call('/api/secrets')
check('无令牌返回 401', noAuth.status === 401, `status=${noAuth.status}`)
const badAuth = await call('/api/secrets', { token: 'invalid.token.value' })
check('无效令牌返回 401', badAuth.status === 401, `status=${badAuth.status}`)

console.log('\n[7] 新增 2FA 账户（AES-GCM 加密入库）')
const created = await call('/api/secrets', {
  method: 'POST',
  token: loginToken,
  body: {
    issuer: 'GitHub',
    accountName: email,
    secret: SECRET,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
  },
})
check('新增成功 (201)', created.status === 201, `status=${created.status} ${created.text.slice(0, 120)}`)
const itemId = created.json?.item?.id

console.log('\n[8] 查询并解密 2FA 账户')
const list = await call('/api/secrets', { token: loginToken })
const item = list.json?.items?.[0]
check('查询返回 1 条记录', list.json?.items?.length === 1, `count=${list.json?.items?.length}`)
check('密钥解密后与原文一致', item?.secret === SECRET, `secret=${item?.secret}`)

console.log('\n[9] 非法密钥应被拒绝')
const badSecret = await call('/api/secrets', {
  method: 'POST',
  token: loginToken,
  body: { issuer: 'X', accountName: 'x@y.com', secret: 'not-base32!!' },
})
check('非法 Base32 返回 400', badSecret.status === 400, `status=${badSecret.status}`)

console.log('\n[10] 删除账户')
const del = await call(`/api/secrets/${itemId}`, { method: 'DELETE', token: loginToken })
check('删除成功', del.status === 200, `status=${del.status}`)
const afterDel = await call('/api/secrets', { token: loginToken })
check('删除后列表为空', afterDel.json?.items?.length === 0, `count=${afterDel.json?.items?.length}`)

console.log('\n[11] 前端静态资源')
const index = await fetch(`${BASE}/`)
const html = await index.text()
check('首页返回 200', index.status === 200, `status=${index.status}`)
check('首页包含应用标题', html.includes('AuthSync'))

console.log('\n[12] SPA 回退路由')
const spa = await fetch(`${BASE}/some/deep/route`)
check('未知路由回退到 index.html', spa.status === 200, `status=${spa.status}`)

console.log(
  `\n${failures === 0 ? '✓ 全部测试通过' : `✗ ${failures} 项测试失败`}\n`,
)
process.exit(failures === 0 ? 0 : 1)
