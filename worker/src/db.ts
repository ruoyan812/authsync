import { createClient, type Client } from '@libsql/client/web'
import type { Env } from './types'

/** 创建 Turso 数据库连接（/web 版本仅依赖 fetch，适用于 Workers 边缘运行时） */
export function getDb(env: Env): Client {
  return createClient({
    url: env.TURSO_DATABASE_URL,
    authToken: env.TURSO_AUTH_TOKEN,
  })
}
