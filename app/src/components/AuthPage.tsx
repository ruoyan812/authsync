import { useEffect, useState, type FormEvent } from 'react'
import { Loader2, LogIn, Mail, ShieldCheck, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { sendEmailCode, verifyEmailCode } from '@/lib/emailOtp'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function AuthPage() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // 邮箱验证码相关
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sending, setSending] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  // 重发冷却倒计时
  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  // 切换登录/注册时重置验证码状态
  useEffect(() => {
    setCode('')
    setCodeSent(false)
    setError('')
  }, [mode])

  // 邮箱变更后原有验证码即失效
  function handleEmailChange(value: string) {
    setEmail(value)
    if (codeSent) {
      setCodeSent(false)
      setCode('')
    }
  }

  async function handleSendCode() {
    setError('')
    const normalized = email.trim().toLowerCase()
    if (!EMAIL_RE.test(normalized)) {
      setError('请先填写有效的邮箱地址')
      return
    }

    setSending(true)
    try {
      const res = await sendEmailCode(normalized)
      if (!res.ok) {
        setError(res.error ?? '验证码发送失败')
        return
      }
      setCodeSent(true)
      setCooldown(60)
      toast.success('验证码已发送至你的邮箱，请查收')
    } finally {
      setSending(false)
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, password)
        return
      }

      // 注册：先校验邮箱验证码，通过后才真正创建账号
      if (!codeSent) {
        setError('请先点击「获取验证码」完成邮箱验证')
        return
      }
      const verified = await verifyEmailCode(email.trim().toLowerCase(), code.trim())
      if (!verified.ok) {
        setError(verified.error ?? '验证码错误')
        return
      }
      await register(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 size-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-32 -bottom-32 size-96 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <Card className="relative z-10 w-full max-w-md border-primary/20 shadow-2xl">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <ShieldCheck className="size-8" />
          </div>
          <CardTitle className="text-2xl font-bold">AuthSync</CardTitle>
          <CardDescription>
            在浏览器中安全地管理您的两步验证（2FA）动态验证码
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">邮箱</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder={mode === 'register' ? '至少 8 位' : '输入密码'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {mode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="code">邮箱验证码</Label>
                <div className="flex gap-2">
                  <Input
                    id="code"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="请输入邮箱收到的验证码"
                    className="font-code"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="shrink-0 cursor-pointer"
                    onClick={handleSendCode}
                    disabled={sending || cooldown > 0 || busy}
                  >
                    {sending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Mail className="size-4" />
                    )}
                    {cooldown > 0 ? `${cooldown}s` : codeSent ? '重新获取' : '获取验证码'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {codeSent
                    ? '验证码已发送至你的邮箱，请查收后填入上方输入框'
                    : '注册前需先验证邮箱，请点击右侧按钮获取验证码'}
                </p>
              </div>
            )}

            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full cursor-pointer"
              disabled={busy || (mode === 'register' && (!codeSent || !code.trim()))}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="size-4" />
              ) : (
                <UserPlus className="size-4" />
              )}
              {mode === 'login' ? '登录' : '注册并开始使用'}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {mode === 'login' ? '还没有账号？' : '已有账号？'}
            <button
              type="button"
              className="ml-1 cursor-pointer font-medium text-primary underline-offset-4 hover:underline"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '立即注册' : '直接登录'}
            </button>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
