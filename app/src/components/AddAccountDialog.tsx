import { useEffect, useRef, useState } from 'react'
import { Camera, ClipboardPaste, Keyboard, Loader2, QrCode, ScanLine } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CameraScanner } from '@/components/CameraScanner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { parseOtpauthInput, readImageFromClipboard, tryExtractFromImage } from '@/lib/totp'
import { cn } from '@/lib/utils'
import type { ParsedOtpauth } from '@/lib/totp'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAdd: (payload: {
    issuer: string
    accountName: string
    secret: string
    algorithm: string
    digits: number
    period: number
  }) => Promise<void>
}

export function AddAccountDialog({ open, onOpenChange, onAdd }: Props) {
  const [tab, setTab] = useState<'qr' | 'camera' | 'manual'>('qr')
  const [parsed, setParsed] = useState<ParsedOtpauth | null>(null)
  const [form, setForm] = useState({ issuer: '', accountName: '', secret: '' })
  const [preview, setPreview] = useState<string | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 打开对话框时重置状态
  useEffect(() => {
    if (open) {
      setTab('qr')
      setParsed(null)
      setPreview(null)
      setManualInput('')
      setError('')
    }
  }, [open])

  async function handleImageBlob(blob: Blob) {
    setBusy(true)
    setError('')
    try {
      const parsed = await tryExtractFromImage(blob)
      if (!parsed) {
        setError('未在图片中识别到二维码，请换一张清晰的截图试试')
        return
      }
      applyParsed(parsed)
      setPreview(URL.createObjectURL(blob))
    } finally {
      setBusy(false)
    }
  }

  function handleFile(file?: File | null) {
    if (!file) return
    handleImageBlob(file)
  }

  async function handlePasteImage() {
    setBusy(true)
    setError('')
    try {
      const blob = await readImageFromClipboard()
      if (!blob) {
        setError('剪切板中没有图片，请先截图（或按 Ctrl+V 直接粘贴）')
        return
      }
      await handleImageBlob(blob)
    } finally {
      setBusy(false)
    }
  }

  // 全局粘贴事件（Ctrl+V）
  useEffect(() => {
    if (!open || tab !== 'qr' || parsed) return
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) handleFile(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab, parsed])

  function applyParsed(p: ParsedOtpauth) {
    setParsed(p)
    setForm({
      issuer: p.issuer,
      accountName: p.accountName,
      secret: p.secret,
    })
  }

  function handleManualParse() {
    setError('')
    const p = parseOtpauthInput(manualInput)
    if (!p) {
      setError('无法识别，请输入 otpauth:// 链接或 Base32 密钥')
      return
    }
    applyParsed(p)
    setPreview(null)
  }

  async function handleSave() {
    if (!parsed) return
    if (!form.accountName.trim() || !form.secret.trim()) {
      setError('请填写账户名称和密钥')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onAdd({
        issuer: form.issuer.trim(),
        accountName: form.accountName.trim(),
        secret: form.secret.replace(/\s+/g, '').toUpperCase(),
        algorithm: parsed.algorithm,
        digits: parsed.digits,
        period: parsed.period,
      })
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>添加两步验证账户</DialogTitle>
          <DialogDescription>通过摄像头拍照、二维码截图、剪切板或手动输入密钥添加账户</DialogDescription>
        </DialogHeader>

        {!parsed ? (
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'qr' | 'camera' | 'manual')}>
            <TabsList className="w-full">
              <TabsTrigger value="qr" className="flex-1 cursor-pointer">
                <QrCode className="size-4" /> 二维码
              </TabsTrigger>
              <TabsTrigger value="camera" className="flex-1 cursor-pointer">
                <Camera className="size-4" /> 拍照
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex-1 cursor-pointer">
                <Keyboard className="size-4" /> 手动输入
              </TabsTrigger>
            </TabsList>

            <TabsContent value="qr" className="space-y-3">
              <button
                type="button"
                onDragOver={(e) => {
                  e.preventDefault()
                  setDragOver(true)
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault()
                  setDragOver(false)
                  handleFile(e.dataTransfer.files?.[0])
                }}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  'flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 transition-colors',
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50 hover:bg-muted/50',
                )}
              >
                <ScanLine className="size-10 text-primary" />
                <div className="text-center">
                  <p className="text-sm font-medium">点击上传二维码截图，或直接 Ctrl+V 粘贴</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    支持从手机 Authenticator / 网站设置页截取的二维码图片
                  </p>
                </div>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFile(e.target.files?.[0])}
              />
              <Button
                type="button"
                variant="outline"
                className="w-full cursor-pointer"
                onClick={handlePasteImage}
                disabled={busy}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ClipboardPaste className="size-4" />}
                从剪切板读取图片
              </Button>
            </TabsContent>

            <TabsContent value="camera" className="space-y-3">
              <CameraScanner
                onDetected={(p) => {
                  applyParsed(p)
                  setPreview(null)
                  setError('')
                }}
              />
            </TabsContent>

            <TabsContent value="manual" className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="manual-input">otpauth:// 链接或 Base32 密钥</Label>
                <Textarea
                  id="manual-input"
                  placeholder={'otpauth://totp/GitHub:user?secret=JBSWY3DPEHPK3PXP&issuer=GitHub\n\n或直接粘贴密钥如 JBSWY3DPEHPK3PXP'}
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  rows={4}
                />
                <p className="text-xs text-muted-foreground">
                  粘贴 Google Authenticator / Authy 导出链接，或服务商提供的设置密钥
                </p>
              </div>
              <Button
                type="button"
                className="w-full cursor-pointer"
                onClick={handleManualParse}
                disabled={!manualInput.trim()}
              >
                解析
              </Button>
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-4">
            {preview && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/40 p-3">
                <img
                  src={preview}
                  alt="二维码预览"
                  className="size-14 rounded-md border object-contain"
                />
                <div className="flex-1 text-xs text-muted-foreground">
                  已从二维码中识别到账户信息，请确认后保存
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="cursor-pointer"
                  onClick={() => {
                    setParsed(null)
                    setPreview(null)
                  }}
                >
                  重新扫描
                </Button>
              </div>
            )}

            <div className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="f-issuer">服务商（可选）</Label>
                  <Input
                    id="f-issuer"
                    placeholder="GitHub"
                    value={form.issuer}
                    onChange={(e) => setForm({ ...form, issuer: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="f-account">账户名称 *</Label>
                  <Input
                    id="f-account"
                    placeholder="user@example.com"
                    value={form.accountName}
                    onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="f-secret">密钥（Base32）</Label>
                <Input
                  id="f-secret"
                  className="font-code"
                  value={form.secret}
                  onChange={(e) => setForm({ ...form, secret: e.target.value })}
                />
              </div>
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-md bg-muted px-2 py-1 font-code">
                  {parsed.algorithm}
                </span>
                <span className="rounded-md bg-muted px-2 py-1 font-code">{parsed.digits} 位</span>
                <span className="rounded-md bg-muted px-2 py-1 font-code">每 {parsed.period}s</span>
              </div>
            </div>

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                className="cursor-pointer"
                onClick={() => {
                  setParsed(null)
                  setPreview(null)
                  setError('')
                }}
              >
                上一步
              </Button>
              <Button type="button" className="cursor-pointer" onClick={handleSave} disabled={busy}>
                {busy && <Loader2 className="size-4 animate-spin" />}
                保存账户
              </Button>
            </div>
          </div>
        )}

        {!parsed && error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}
