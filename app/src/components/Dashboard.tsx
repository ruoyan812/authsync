import { useCallback, useEffect, useState } from 'react'
import { LogOut, Plus, ShieldCheck, ShieldQuestion, UserCog } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ThemeToggle } from '@/components/ThemeToggle'
import { HomeButton } from '@/components/HomeButton'
import { AccountCard } from '@/components/AccountCard'
import { AddAccountDialog } from '@/components/AddAccountDialog'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import type { TotpAccount } from '@/types'

export function Dashboard({ onOpenAdmin }: { onOpenAdmin: () => void }) {
  const { user, logout } = useAuth()
  const [accounts, setAccounts] = useState<TotpAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const { items } = await api.listSecrets()
      setAccounts(items)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function handleAdd(payload: {
    issuer: string
    accountName: string
    secret: string
    algorithm: string
    digits: number
    period: number
  }) {
    await api.createSecret(payload)
    await refresh()
    toast.success('账户已添加')
  }

  async function handleDelete(id: string) {
    try {
      await api.deleteSecret(id)
      setAccounts((prev) => prev.filter((a) => a.id !== id))
      toast.success('账户已删除')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '删除失败')
    }
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/30">
              <ShieldCheck className="size-5" />
            </div>
            <div>
              <p className="font-bold leading-tight">AuthSync</p>
              <p className="text-xs leading-tight text-muted-foreground">两步验证管理器</p>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            {user?.role === 'admin' && (
              <Button
                variant="ghost"
                size="sm"
                className="cursor-pointer"
                onClick={onOpenAdmin}
                aria-label="管理后台"
              >
                <UserCog className="size-4" />
                <span className="hidden sm:inline">管理</span>
              </Button>
            )}
            <HomeButton />
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
            <h1 className="text-2xl font-bold">我的账户</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              共 {accounts.length} 个账户，验证码每 30 秒自动刷新
            </p>
          </div>
          <Button className="cursor-pointer" onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" /> 添加账户
          </Button>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44 rounded-xl" />
            ))}
          </div>
        ) : accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed py-20 text-center">
            <ShieldQuestion className="mb-4 size-14 text-muted-foreground/50" />
            <h2 className="text-lg font-semibold">还没有添加任何账户</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              用摄像头直接拍照、从网站截取二维码，或用 otpauth:// 链接添加你的第一个两步验证账户
            </p>
            <Button className="mt-6 cursor-pointer" onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" /> 添加第一个账户
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((account) => (
              <AccountCard key={account.id} account={account} onDelete={handleDelete} />
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-muted-foreground/70">
          提示：点击验证码可复制。请勿在公共设备上使用，您的密钥经加密后存储于服务器数据库。
        </p>
      </main>

      <AddAccountDialog open={dialogOpen} onOpenChange={setDialogOpen} onAdd={handleAdd} />
    </div>
  )
}
