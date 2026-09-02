/**
 * 邮箱验证码：前端调用同源的 /api/email-otp/*，由 Worker 转发至
 * otp.login.roooooyan.work（上游未处理 CORS 预检，浏览器无法直接 POST）。
 */

interface OtpResponse {
  status?: string
  dev?: boolean
  message?: string
  error?: string
}

export interface EmailOtpResult {
  ok: boolean
  error?: string
}

/** 向指定邮箱发送验证码 */
export async function sendEmailCode(email: string): Promise<EmailOtpResult> {
  try {
    const res = await fetch(`/api/email-otp/start?email=${encodeURIComponent(email)}`)
    const data = (await res.json().catch(() => ({}))) as OtpResponse
    const status = data.status ?? ''

    if (status === 'sent' || status === 'ok') return { ok: true }
    if (data.error) return { ok: false, error: data.error }
    if (status === 'mail_error') {
      return { ok: false, error: '验证码邮件发送失败，请确认邮箱地址是否正确' }
    }
    if (status === 'rate_limited') {
      return { ok: false, error: '发送过于频繁，请稍后再试' }
    }
    return { ok: false, error: '验证码发送失败，请稍后重试' }
  } catch {
    return { ok: false, error: '验证码发送失败，请检查网络后重试' }
  }
}

/** 校验邮箱收到的验证码 */
export async function verifyEmailCode(email: string, code: string): Promise<EmailOtpResult> {
  try {
    const res = await fetch('/api/email-otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    const data = (await res.json().catch(() => ({}))) as OtpResponse
    const status = data.status ?? ''

    if (status === 'ok') return { ok: true }
    if (data.error) return { ok: false, error: data.error }
    if (status === 'expired') return { ok: false, error: '验证码已过期，请重新获取' }
    return { ok: false, error: '验证码错误，请重新输入' }
  } catch {
    return { ok: false, error: '验证码校验失败，请检查网络后重试' }
  }
}
