import type { Env } from './types'

const FROM = 'Yanverse 2FA <2fa-account@mail.roooooyan.work>'
const SITE_URL = 'https://2fa.roooooyan.work'
const RESEND_API = 'https://api.resend.com/emails'

const BRAND = '#0EA5E9'

function buildWelcomeHtml(email: string): string {
  return `<!doctype html>
<html lang="zh-CN">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:#0b1220;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b1220;padding:32px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <span style="display:inline-block;width:34px;height:34px;border-radius:9px;background:${BRAND};"></span>
                  <span style="font-size:18px;font-weight:700;color:#f8fafc;">Yanverse · 2FA</span>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 0;">
                <h1 style="margin:0 0 12px;font-size:22px;line-height:1.35;color:#f8fafc;">欢迎加入，账号已创建成功 🎉</h1>
                <p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:#cbd5e1;">
                  你好 <span style="color:#f8fafc;font-weight:600;">${email}</span>，
                  你的 Yanverse · 2FA 账号已经注册成功。现在你可以在一个安全的地方集中管理所有两步验证（TOTP / 2FA）动态验证码。
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 0;">
                <div style="background:#0b1220;border:1px solid #1f2937;border-radius:12px;padding:16px 18px;">
                  <p style="margin:0 0 10px;font-size:14px;font-weight:600;color:#f8fafc;">你可以：</p>
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#cbd5e1;">• 通过二维码 / 剪切板 / 手动输入添加 OTP 账户</p>
                  <p style="margin:0 0 8px;font-size:14px;line-height:1.7;color:#cbd5e1;">• 实时查看每个账户的 30s 动态验证码</p>
                  <p style="margin:0;font-size:14px;line-height:1.7;color:#cbd5e1;">• 由管理员统一管理团队账号与密钥</p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px;">
                <a href="${SITE_URL}" style="display:inline-block;background:${BRAND};color:#04141f;text-decoration:none;font-size:15px;font-weight:700;padding:12px 28px;border-radius:10px;">前往登录</a>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;">
                <p style="margin:0;font-size:12px;line-height:1.6;color:#64748b;">
                  这是一封自动发送的注册通知邮件，无需回复。<br/>© Yanverse · 2FA
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** 注册成功后发送欢迎邮件；返回发送诊断结果 */
export async function sendWelcomeEmail(
  to: string,
  env: Env,
): Promise<{ ok: boolean; keyPresent: boolean; status?: number; error?: string }> {
  if (!env.RESEND_API_KEY) {
    console.warn('[email] 未配置 RESEND_API_KEY，跳过欢迎邮件发送')
    return { ok: false, keyPresent: false, error: 'missing-key' }
  }

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        subject: '欢迎加入 Yanverse · 2FA',
        html: buildWelcomeHtml(to),
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error('[email] Resend 发送失败:', res.status, text)
      return { ok: false, keyPresent: true, status: res.status, error: text }
    }
    return { ok: true, keyPresent: true, status: res.status }
  } catch (e) {
    console.error('[email] 调用 Resend 异常:', e)
    return { ok: false, keyPresent: true, error: String(e) }
  }
}
