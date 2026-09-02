/**
 * 邮箱验证码服务封装（基于 https://otp.login.roooooyan.work/otp.js 注入的 window.OTP）
 * 统一把服务返回的状态码翻译成面向用户的中文提示。
 */

export interface EmailOtpResult {
  ok: boolean
  error?: string
}

function getOtp(): OtpApi | null {
  if (typeof window === 'undefined') return null
  return window.OTP ?? null
}

/** 向指定邮箱发送验证码 */
export async function sendEmailCode(email: string): Promise<EmailOtpResult> {
  const otp = getOtp()
  if (!otp) return { ok: false, error: '验证码服务未加载，请刷新页面后重试' }

  let status = ''
  try {
    const res = await otp.start(email)
    status = res?.status ?? ''
  } catch {
    return { ok: false, error: '验证码发送失败，请检查网络后重试' }
  }

  if (status === 'sent' || status === 'ok') return { ok: true }
  if (status === 'mail_error') {
    return { ok: false, error: '验证码邮件发送失败，请确认邮箱地址是否正确' }
  }
  if (status === 'rate_limited') {
    return { ok: false, error: '发送过于频繁，请稍后再试' }
  }
  return { ok: false, error: '验证码发送失败，请稍后重试' }
}

/** 校验邮箱收到的验证码 */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<EmailOtpResult> {
  const otp = getOtp()
  if (!otp) return { ok: false, error: '验证码服务未加载，请刷新页面后重试' }

  let status = ''
  try {
    const res = await otp.verify(email, code)
    status = res?.status ?? ''
  } catch {
    return { ok: false, error: '验证码校验失败，请检查网络后重试' }
  }

  if (status === 'ok') return { ok: true }
  if (status === 'expired') return { ok: false, error: '验证码已过期，请重新获取' }
  return { ok: false, error: '验证码错误，请重新输入' }
}
