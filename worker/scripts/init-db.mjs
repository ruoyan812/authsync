#!/usr/bin/env node
/**
 * 在远程 Turso 数据库上创建表结构。
 * 用法: npm run db:init
 * 从 .dev.vars（本地）或 process.env 读取连接凭据。
 */
import { createClient } from '@libsql/client'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const workerDir = join(__dirname, '..')

/** 解析 KEY=value 格式的配置文件 */
function readEnvFile(path) {
  const vars = {}
  if (!existsSync(path)) return vars
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    vars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
  }
  return vars
}

const fileVars = readEnvFile(join(workerDir, '.dev.vars'))
const url = process.env.TURSO_DATABASE_URL || fileVars.TURSO_DATABASE_URL
const authToken = process.env.TURSO_AUTH_TOKEN || fileVars.TURSO_AUTH_TOKEN

if (!url) {
  console.error('错误: 未找到 TURSO_DATABASE_URL，请在 worker/.dev.vars 中配置')
  process.exit(1)
}

const schema = readFileSync(join(workerDir, 'schema.sql'), 'utf8')

console.log(`正在连接 ${url} ...`)
const db = createClient({ url, authToken })

try {
  await db.executeMultiple(schema)
  const result = await db.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
  )
  console.log('✓ 表结构已就绪:')
  for (const row of result.rows) console.log(`  - ${row.name}`)
} catch (err) {
  console.error('✗ 初始化失败:', err instanceof Error ? err.message : err)
  process.exit(1)
} finally {
  db.close()
}
