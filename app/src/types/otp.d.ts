/** https://otp.login.roooooyan.work/otp.js 注入的全局 OTP 对象 */
interface OtpStartResult {
  status: string
  dev?: boolean
}

interface OtpVerifyResult {
  status: string
}

interface OtpApi {
  start: (email: string) => Promise<OtpStartResult>
  verify: (email: string, code: string) => Promise<OtpVerifyResult>
  login: (opts?: Record<string, unknown>) => void
}

interface Window {
  OTP?: OtpApi
}
