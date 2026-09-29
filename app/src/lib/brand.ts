/**
 * 根据账户 issuer / 邮箱自动寻找品牌 favicon。
 * 匹配不到或加载失败时返回 null，由调用方回退到首字母头像。
 *
 * 使用 DuckDuckGo 的无密钥 favicon 服务，无需 API Key：
 *   https://icons.duckduckgo.com/ip3/<domain>.ico
 * （找不到对应域名时该服务返回 404，前端 onError 即回退首字母）
 */

// 常见 2FA 服务商 → 其官网域名（用于取 favicon）
const KNOWN_BRANDS: Record<string, string> = {
  github: 'github.com',
  gitlab: 'gitlab.com',
  bitbucket: 'bitbucket.org',
  google: 'google.com',
  gmail: 'google.com',
  youtube: 'youtube.com',
  microsoft: 'microsoft.com',
  outlook: 'microsoft.com',
  live: 'microsoft.com',
  office365: 'microsoft.com',
  xbox: 'xbox.com',
  'xbox live': 'xbox.com',
  sony: 'sony.com',
  playstation: 'playstation.com',
  apple: 'apple.com',
  icloud: 'apple.com',
  amazon: 'amazon.com',
  aws: 'aws.amazon.com',
  amazonwebservices: 'aws.amazon.com',
  discord: 'discord.com',
  steam: 'steamcommunity.com',
  'steam community': 'steamcommunity.com',
  battlenet: 'battle.net',
  blizzard: 'blizzard.com',
  epic: 'epicgames.com',
  'epic games': 'epicgames.com',
  roblox: 'roblox.com',
  nintendo: 'nintendo.com',
  'nintendo account': 'nintendo.com',
  autodesk: 'autodesk.com',
  ubisoft: 'ubisoft.com',
  ea: 'ea.com',
  origin: 'ea.com',
  twitch: 'twitch.tv',
  facebook: 'facebook.com',
  meta: 'meta.com',
  instagram: 'instagram.com',
  whatsapp: 'whatsapp.com',
  twitter: 'x.com',
  x: 'x.com',
  telegram: 'telegram.org',
  signal: 'signal.org',
  dropbox: 'dropbox.com',
  slack: 'slack.com',
  cloudflare: 'cloudflare.com',
  notion: 'notion.so',
  line: 'line.me',
  'line corporation': 'line.me',
  paypal: 'paypal.com',
  coinbase: 'coinbase.com',
  binance: 'binance.com',
  kraken: 'kraken.com',
  okta: 'okta.com',
  auth0: 'auth0.com',
  zoom: 'zoom.us',
  spotify: 'spotify.com',
  netflix: 'netflix.com',
  linkedin: 'linkedin.com',
  tiktok: 'tiktok.com',
  reddit: 'reddit.com',
  salesforce: 'salesforce.com',
  digitalocean: 'digitalocean.com',
  heroku: 'heroku.com',
  vercel: 'vercel.com',
  namecheap: 'namecheap.com',
  proton: 'proton.me',
  protonmail: 'proton.me',
  fastmail: 'fastmail.com',
  yahoo: 'yahoo.com',
  oracle: 'oracle.com',
  atlassian: 'atlassian.com',
  jira: 'atlassian.com',
  shopify: 'shopify.com',
  stripe: 'stripe.com',
  gitee: 'gitee.com',
  aliyun: 'aliyun.com',
  '阿里云': 'aliyun.com',
  tencent: 'tencent.com',
  '腾讯': 'tencent.com',
  baidu: 'baidu.com',
  wechat: 'wechat.com',
  '微信': 'wechat.com',
  '网易': '163.com',
  netease: '163.com',
}

function favicon(domain: string): string {
  return `https://icons.duckduckgo.com/ip3/${domain}.ico`
}

/**
 * 返回品牌 favicon 地址；无法确定时返回 null。
 *
 * 匹配优先级（避免把邮箱服务商误当成品牌）：
 *   1. issuer 命中已知品牌表（最可靠）
 *   2. issuer 本身就像域名（含 "."）
 *   3. 仅当没有 issuer 时，才用邮箱域名兜底（如 @gmail.com → Google）
 *   4. 单词语 issuer 尽力尝试 <issuer>.com（DuckDuckGo 找不到会 404 → 首字母兜底）
 */
export function brandLogoUrl(issuer: string, accountName: string): string | null {
  const raw = (issuer || '').trim()
  const key = raw.toLowerCase()

  // 1) 已知品牌
  if (key && KNOWN_BRANDS[key]) return favicon(KNOWN_BRANDS[key])

  // 2) issuer 本身就是域名
  if (key.includes('.')) return favicon(key)

  // 3) 没有 issuer 时，才用邮箱域名兜底
  if (!key) {
    const emailMatch = accountName.match(/@([\w.-]+)/)
    if (emailMatch) return favicon(emailMatch[1])
    return null
  }

  // 4) 尽力而为：纯单词 issuer 尝试 <issuer>.com（DuckDuckGo 404 时回退首字母）
  if (/^[a-z0-9]+$/.test(key)) return favicon(`${key}.com`)

  return null
}
