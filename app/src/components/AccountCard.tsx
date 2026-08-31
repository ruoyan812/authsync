import { useMemo, useState } from 'react'
import { Check, Copy, Trash2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useNow } from '@/hooks/useNow'
import { generateCode } from '@/lib/totp'
import { cn } from '@/lib/utils'
import type { TotpAccount } from '@/types'

const AVATAR_COLORS = [
  'bg-sky-500',
  'bg-emerald-500',
  'bg-violet-500',
  'bg-rose-500',
  'bg-amber-500',
  'bg-cyan-500',
  'bg-indigo-500',
  'bg-teal-500',
]

function colorFor(seed: string) {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface Props {
  account: TotpAccount
  onDelete: (id: string) => void
}

export function AccountCard({ account, onDelete }: Props) {
  const now = useNow(250)
  const counter = Math.floor(now / 1000)
  const periodStart = counter - (counter % account.period)
  const code = useMemo(
    () => generateCode(account, periodStart),
    // periodStart 每次变化都重新生成验证码
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [account, periodStart],
  )
  const remaining = account.period - (counter % account.period)
  const progress = remaining / account.period
  const [copied, setCopied] = useState(false)

  const label = [account.issuer, account.accountName].filter(Boolean).join(' · ')
  const initials = (account.issuer || account.accountName || '?').slice(0, 2).toUpperCase()

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 忽略剪贴板权限错误
    }
  }

  const ringColor = remaining <= 5 ? 'text-destructive' : 'text-primary'

  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-200 hover:shadow-lg hover:shadow-primary/5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white shadow-sm',
              colorFor(account.issuer || account.accountName),
            )}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-muted-foreground">{account.issuer || '自定义账户'}</p>
            <p className="truncate font-semibold">{account.accountName}</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onDelete(account.id)}
          className="cursor-pointer rounded-md p-2 text-muted-foreground opacity-60 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-hover:opacity-100"
          aria-label={`删除 ${label}`}
          title="删除账户"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={copyCode}
        className="mt-4 flex w-full cursor-pointer items-end justify-between gap-3 text-left"
        title="点击复制验证码"
      >
        <span
          key={code}
          className={cn(
            'font-code text-4xl font-bold tracking-[0.18em] tabular-nums transition-all duration-200',
            'animate-[code-pop_0.25s_ease-out]',
          )}
        >
          {code.slice(0, code.length / 2)}
          <span className="mx-1 text-foreground/20">{' '}</span>
          {code.slice(code.length / 2)}
        </span>
        {copied ? (
          <Check className="size-5 shrink-0 text-accent" />
        ) : (
          <Copy className="size-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      <div className="mt-4 flex items-center gap-3">
        <div className="relative size-9 shrink-0">
          <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-border" />
            <circle
              cx="18"
              cy="18"
              r="15"
              fill="none"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${(progress * 94.25).toFixed(1)} 94.25`}
              className={cn('transition-all duration-200', ringColor)}
            />
          </svg>
        </div>
        <div className="text-xs text-muted-foreground">
          <span className="font-code font-medium">{remaining}s</span> 后刷新
        </div>
        <span className="ml-auto font-code text-[11px] text-muted-foreground/70">
          {account.algorithm} · {account.digits} 位 · 每 {account.period}s
        </span>
      </div>
    </Card>
  )
}
