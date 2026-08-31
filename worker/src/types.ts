/** Cloudflare Workers 环境变量与绑定 */
export interface Env {
  /** 静态资源绑定（前端构建产物） */
  ASSETS: Fetcher
  /** Turso 数据库地址，如 libsql://xxx.turso.io */
  TURSO_DATABASE_URL: string
  /** Turso 访问令牌（Secret） */
  TURSO_AUTH_TOKEN: string
  /** AES-256 主密钥，64 位十六进制（Secret） */
  MASTER_KEY: string
  /** JWT 签名密钥（Secret） */
  JWT_SECRET: string
  /** PBKDF2 迭代次数，默认 100000 */
  PBKDF2_ITERATIONS?: string
}
