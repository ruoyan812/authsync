import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { api, getStoredUser, getToken, setStoredUser, setToken, RequestError } from '@/lib/api'
import type { User } from '@/types'

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  // 启动时直接用本地缓存的账号信息恢复登录态（有缓存则无需等待网络）
  const [user, setUser] = useState<User | null>(() => getStoredUser())
  const [loading, setLoading] = useState(() => !(getToken() && getStoredUser()))

  // 后台校验令牌有效性并刷新账号信息（如角色变更）
  useEffect(() => {
    let cancelled = false
    async function bootstrap() {
      if (!getToken()) {
        setStoredUser(null)
        setUser(null)
        setLoading(false)
        return
      }
      try {
        const { user: me } = await api.me()
        if (cancelled) return
        setUser(me)
        setStoredUser(me)
      } catch (err) {
        if (cancelled) return
        // 仅令牌失效（401）才登出；网络抖动等其它错误保留登录态，避免误登出
        if (err instanceof RequestError && err.status === 401) {
          setToken(null)
          setStoredUser(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.login(email, password)
    setToken(token)
    setUser(user)
    setStoredUser(user)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const { token, user } = await api.register(email, password)
    setToken(token)
    setUser(user)
    setStoredUser(user)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setStoredUser(null)
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth 必须在 <AuthProvider> 内使用')
  return ctx
}
