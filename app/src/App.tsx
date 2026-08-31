import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthPage } from '@/components/AuthPage'
import { Dashboard } from '@/components/Dashboard'
import { AdminPage } from '@/components/AdminPage'
import { AuthProvider, useAuth } from '@/hooks/useAuth'

function AppShell() {
  const { user, loading } = useAuth()
  const [adminView, setAdminView] = useState(false)

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user) return <AuthPage />

  return adminView ? (
    <AdminPage onBack={() => setAdminView(false)} />
  ) : (
    <Dashboard onOpenAdmin={() => setAdminView(true)} />
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  )
}
