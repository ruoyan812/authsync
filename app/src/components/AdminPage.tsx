import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { ArrowLeft, KeyRound, Loader2, LogOut, Plus, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ThemeToggle } from '@/components/ThemeToggle'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { AdminSecret, AdminUser } from '@/types'

function RoleBadge({ role }: { role: 'user' | 'admin' }) {
  return role === 'admin' ? (
    <Badge className="bg-primary/15 text-primary hover:bg-primary/20">管理员</Badge>
  ) : (
    <Badge variant="secondary">普通用户</Badge>
  )
}

function AddUserDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreated: () => void
}) {
  const [form, setForm] = useState({ email: '', password: '', role: 'user' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setForm({ email: '', password: '', role: 'user' })
      setError('')
    }
  }, [open])

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.createUser(form.email.trim(), form.password, form.role as 'user' | 'admin')
      toast.success('用户已创建')
      onOpenChange(false)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>添加用户</DialogTitle>
          <DialogDescription>创建新账号，并可指定其角色</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="au-email">邮箱</Label>
            <Input
              id="au-email"
              type="email"
              placeholder="user@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="au-password">密码（至少 8 位）</Label>
            <Input
              id="au-password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label>角色</Label>
            <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
              <SelectTrigger>
                <SelectValue placeholder="选择角色" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">普通用户</SelectItem>
                <SelectItem value="admin">管理员</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" className="cursor-pointer" disabled={busy || !form.email || form.password.length < 8}>
              {busy && <Loader2 className="size-4 animate-spin" />}
              创建
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function OtpDialog({
  user,
  open,
  onOpenChange,
}: {
  user: AdminUser | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [items, setItems] = useState<AdminSecret[]>([])
  const [fetchedAt, setFetchedAt] = useState(0)
  const [now, setNow] = useState(0)
  const [busy, setBusy] = useState(false)

  const fetchSecrets = useCallback(async () => {
    if (!user) return
    setBusy(true)
    try {
      const { items } = await api.listUserSecrets(user.id)
      setItems(items)
      setFetchedAt(Date.now())
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setBusy(false)
    }
  }, [user])

  useEffect(() => {
    if (open && user) fetchSecrets()
    else {
      setItems([])
      setFetchedAt(0)
    }
  }, [open, user, fetchSecrets])

  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [open])

  // 验证码滚动到下一周期时重新拉取
  useEffect(() => {
    if (!open || !fetchedAt || items.length === 0) return
    const nextChange = Math.min(
      ...items.map((it) => Math.ceil(fetchedAt / 1000 / it.period) * it.period * 1000),
    )
    if (now >= nextChange && now > fetchedAt) fetchSecrets()
  }, [now, fetchedAt, items, open, fetchSecrets])

  const period = items[0]?.period ?? 30
  const nextChange = items.length
    ? Math.min(...items.map((it) => Math.ceil(fetchedAt / 1000 / it.period) * it.period * 1000))
    : 0
  const remaining = nextChange ? Math.max(0, Math.ceil((nextChange - now) / 1000)) : 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{user?.email} 的 OTP 账户</DialogTitle>
          <DialogDescription>当前动态验证码（每 {period}s 刷新一次）</DialogDescription>
        </DialogHeader>

        {busy && items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 size-4 animate-spin" /> 加载中…
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">该用户尚未绑定任何 OTP 账户</p>
        ) : (
          <div className="space-y-3">
            <Progress value={(remaining / period) * 100} />
            <p className="text-right text-xs text-muted-foreground">{remaining}s 后刷新</p>
            {items.map((it) => (
              <div key={it.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{it.issuer || it.accountName}</p>
                    <p className="truncate text-xs text-muted-foreground">{it.accountName}</p>
                  </div>
                  <code className="shrink-0 font-code text-2xl tracking-widest">{it.currentCode}</code>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AdminPage({ onBack }: { onBack: () => void }) {
  const { user, logout } = useAuth()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [otpUser, setOtpUser] = useState<AdminUser | null>(null)

  const load = useCallback(async () => {
    try {
      const { users } = await api.listUsers()
      setUsers(users)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载用户失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleRoleChange(u: AdminUser, role: 'user' | 'admin') {
    try {
      await api.setUserRole(u.id, role)
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, role } : x)))
      toast.success(`已将 ${u.email} 设为${role === 'admin' ? '管理员' : '普通用户'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '操作失败')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Button variant="ghost" size="icon" className="cursor-pointer" onClick={onBack} aria-label="返回">
            <ArrowLeft className="size-4" />
          </Button>
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="font-bold leading-tight">管理后台</p>
              <p className="text-xs leading-tight text-muted-foreground">用户与 OTP 账户管理</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <ThemeToggle />
            <Button variant="ghost" size="icon" className="cursor-pointer" onClick={logout} aria-label="退出登录">
              <LogOut className="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">用户管理</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {users.length} 名用户
            </p>
          </div>
          <Button className="cursor-pointer" onClick={() => setAddOpen(true)}>
            <Plus className="size-4" /> 添加用户
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="text-center">OTP 账户</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              ) : users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-sm text-muted-foreground">
                    暂无用户
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.email}</TableCell>
                    <TableCell>
                      <RoleBadge role={u.role} />
                    </TableCell>
                    <TableCell className="text-center">{u.secretCount}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => setOtpUser(u)}
                        >
                          <KeyRound className="size-3.5" /> 查看 OTP
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="cursor-pointer"
                          onClick={() => handleRoleChange(u, u.role === 'admin' ? 'user' : 'admin')}
                        >
                          {u.role === 'admin' ? '设为普通用户' : '设为管理员'}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </main>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} onCreated={load} />
      <OtpDialog user={otpUser} open={!!otpUser} onOpenChange={(o) => !o && setOtpUser(null)} />
    </div>
  )
}
