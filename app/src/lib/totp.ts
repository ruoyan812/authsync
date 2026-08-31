import { TOTP, URI } from 'otpauth'
import jsQR from 'jsqr'
import type { TotpAccount } from '@/types'

export interface ParsedOtpauth {
  issuer: string
  accountName: string
  secret: string
  algorithm: 'SHA1' | 'SHA256' | 'SHA512'
  digits: number
  period: number
}

/** 依据账户参数在指定时间点生成 TOTP 验证码 */
export function generateCode(account: TotpAccount, atSeconds?: number): string {
  const totp = new TOTP({
    issuer: account.issuer,
    label: account.accountName,
    algorithm: account.algorithm as 'SHA1' | 'SHA256' | 'SHA512',
    digits: account.digits,
    period: account.period,
    secret: account.secret,
  })
  return totp.generate({ timestamp: (atSeconds ?? Math.floor(Date.now() / 1000)) * 1000 })
}

/** 解析 otpauth:// URI 或裸 Base32 密钥，返回账户参数 */
export function parseOtpauthInput(input: string): ParsedOtpauth | null {
  const text = input.trim()
  if (!text) return null

  if (/^otpauth:\/\//i.test(text)) {
    try {
      const parsed = URI.parse(text)
      // 仅支持基于时间的 TOTP 类型
      if (!(parsed instanceof TOTP)) return null
      return {
        issuer: parsed.issuer || '',
        accountName: parsed.label?.replace(/^[^:]*:/, '') || '未命名账户',
        secret: parsed.secret.base32,
        algorithm: parsed.algorithm as 'SHA1' | 'SHA256' | 'SHA512',
        digits: parsed.digits,
        period: parsed.period,
      }
    } catch {
      return null
    }
  }

  // 裸 Base32 密钥
  const secret = text.replace(/\s+/g, '').toUpperCase()
  if (/^[A-Z2-7]+={0,6}$/.test(secret)) {
    return {
      issuer: '',
      accountName: '',
      secret,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    }
  }
  return null
}

const MAX_DIMENSION = 1280

async function blobToImageData(blob: Blob): Promise<ImageData | null> {
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()

    const scale = Math.min(1, MAX_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight))
    const w = Math.max(1, Math.round(img.naturalWidth * scale))
    const h = Math.max(1, Math.round(img.naturalHeight * scale))

    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, w, h)
    return ctx.getImageData(0, 0, w, h)
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** 从图片文件/Blob 中识别二维码，返回其中的字符串内容（通常为 otpauth:// URI） */
export async function decodeQrFromBlob(blob: Blob): Promise<string | null> {
  const imageData = await blobToImageData(blob)
  if (!imageData) return null
  const result = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth',
  })
  return result?.data ?? null
}

/** 从剪切板读取一张图片 */
export async function readImageFromClipboard(): Promise<Blob | null> {
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const type = item.types.find((t) => t.startsWith('image/'))
      if (type) {
        return await item.getType(type)
      }
    }
  } catch {
    // 权限被拒绝或无图片时忽略
  }
  return null
}

/** 尝试解析任意输入：先当二维码图片处理，再当文本处理 */
export async function tryExtractFromImage(blob: Blob): Promise<ParsedOtpauth | null> {
  const raw = await decodeQrFromBlob(blob)
  if (!raw) return null
  return parseOtpauthInput(raw)
}
