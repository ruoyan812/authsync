# AuthSync — Web 版两步验证（2FA）管理器

在浏览器中管理您的 TOTP 两步验证动态码，功能对标手机 Authenticator 应用。

## 功能

- 用户注册 / 登录（JWT 会话，30 天有效）
- 通过**上传二维码截图**或**剪切板粘贴（Ctrl+V）**自动识别并导入账户
- **手动输入** `otpauth://` 链接或 Base32 密钥
- 实时生成 6 位动态验证码，带 30 秒倒计时环形进度条，点击即可复制
- 支持浅色 / 深色主题
- 2FA 密钥经 **AES-256-GCM 加密**后存储于 Turso 数据库

## 技术栈与架构

| 层 | 技术 |
|----|------|
| 前端 | React + TypeScript + Vite + Tailwind CSS + shadcn/ui |
| 后端 | Cloudflare Workers + Hono |
| 数据库 | Turso（云 SQLite，经 `@libsql/client/web` 访问） |
| 部署 | Wrangler CLI + GitHub Actions |
| 域名 | Cloudflare 自定义域名（自动签发 HTTPS 证书） |

单个 Cloudflare Worker 同时托管前端静态资源与 API，无需额外的隧道或服务器。

```
├── app/                    # 前端（Vite 构建产物输出到 ../worker/dist）
│   └── src/
│       ├── components/     # AuthPage / Dashboard / AccountCard / AddAccountDialog
│       ├── hooks/          # useAuth / useNow
│       └── lib/            # api.ts（接口客户端）、totp.ts（TOTP 与二维码解析）
├── worker/                 # Cloudflare Worker（API + 静态资源托管）
│   ├── src/
│   │   ├── index.ts        # Hono 路由
│   │   ├── crypto.ts       # Web Crypto: AES-GCM / PBKDF2 / JWT
│   │   └── db.ts           # Turso 连接
│   ├── scripts/            # init-db.mjs（建表）、smoke-test.mjs（端到端测试）
│   ├── schema.sql
│   └── wrangler.jsonc
└── .github/workflows/      # GitHub Actions 自动部署
```

## 本地开发

```bash
# 1. 安装依赖
cd app    && npm install
cd ../worker && npm install

# 2. 配置本地环境变量
cp worker/.dev.vars.example worker/.dev.vars
# 填入 TURSO_DATABASE_URL / TURSO_AUTH_TOKEN / MASTER_KEY / JWT_SECRET

# 3. 初始化远程数据库表结构（首次）
cd worker && npm run db:init

# 4. 启动（需要两个终端）
cd worker && npm run dev      # Worker API @ http://localhost:8787
cd app    && npm run dev      # 前端 @ http://localhost:5173（已代理 /api 到 8787）
```

## 部署

### 1. 首次部署

```bash
cd app && npm run build        # 构建前端到 worker/dist
cd ../worker
npx wrangler login             # 登录 Cloudflare
npx wrangler secret put TURSO_AUTH_TOKEN
npx wrangler secret put MASTER_KEY
npx wrangler secret put JWT_SECRET
npx wrangler deploy
```

> Secret 只需设置一次，后续部署会保留。切勿使用 `--keep-vars` 以外的方式覆盖。

### 2. 自定义域名

编辑 `worker/wrangler.jsonc` 中的 `routes`（域名需托管在同一 Cloudflare 账户）：

```jsonc
"routes": [{ "pattern": "auth.yourdomain.com", "custom_domain": true }]
```

重新执行 `npx wrangler deploy`，Wrangler 会自动创建 DNS 记录并签发证书。

### 3. GitHub Actions 自动部署

在仓库 Settings → Secrets 中添加：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌（Workers 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | 账户 ID |

推送到 `main` 分支即自动构建并部署。

### 4. 验证部署

```bash
node worker/scripts/smoke-test.mjs https://auth.yourdomain.com
```

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/health` | 健康检查 |
| POST | `/api/auth/register` | 注册 `{ email, password }` |
| POST | `/api/auth/login` | 登录，返回 `{ token, user }` |
| GET | `/api/auth/me` | 校验令牌（Bearer） |
| GET | `/api/secrets` | 列出当前用户的全部账户 |
| POST | `/api/secrets` | 新增账户 |
| DELETE | `/api/secrets/:id` | 删除账户 |

## 安全说明

- 密码使用 **PBKDF2-SHA256** 加盐哈希，迭代次数通过 `PBKDF2_ITERATIONS` 配置
- 2FA 密钥使用 **AES-256-GCM** 加密后入库，`MASTER_KEY` 丢失将无法解密既有数据
- 登录令牌为 JWT（HS256，30 天），全程 HTTPS
- 已验证 TOTP 算法与 RFC 6238 官方测试向量一致（`94287082 / 07081804 / 14050471`）

### Workers 免费版注意事项

免费版 CPU 时间上限为 **10ms**，密码哈希（PBKDF2）是 CPU 密集型操作：

- 默认 `PBKDF2_ITERATIONS=25000`（约 5ms），可在免费版稳定运行
- 已实测：10 万迭代约 18ms，会触发 **Error 1102**（超出 CPU 限制）
- 若升级到 Workers Paid（30s CPU），建议提高到 600000：
  ```bash
  npx wrangler secret put PBKDF2_ITERATIONS   # 输入 600000
  ```

## 常见问题

**Q: `*.workers.dev` 返回 Error 1101**
该账户的 `workers.dev` 子域存在异常（所有 Worker 均受影响，包括历史部署的），属账户层面问题。解决方式是使用自定义域名（`routes` + `custom_domain`），不受此影响。

**Q: 部署报错 "CPU limits are not supported for the Free plan"**
`wrangler.jsonc` 中的 `limits.cpu_ms` 仅付费版支持，免费版请删除该配置项。
