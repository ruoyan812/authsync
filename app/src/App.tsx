import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthPage } from '@/components/AuthPage'
import { Dashboard } from '@/components/Dashboard'
import { AdminPage } from '@/components/AdminPage'
import { AuthProvider, useAuth } from '@/hooks/useAuth'
import { useDeviceScale } from '@/hooks/useDeviceScale'
import { DeviceScaleDebug } from '@/components/DeviceScaleDebug'

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
  useDeviceScale()
  return (
    <AuthProvider>
      <AppShell />
      <DeviceScaleDebug />
    </AuthProvider>
  )
}
