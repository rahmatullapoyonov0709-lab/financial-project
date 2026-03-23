import { useState, useEffect } from 'react'
import { Toaster, toast } from 'react-hot-toast'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Transactions from './pages/Transactions'
import Transfers from './pages/Transfers'
import Debts from './pages/Debts'
import Budget from './pages/Budget'
import Analytics from './pages/Analytics'
import Report from './pages/Report'
import Settings from './pages/Settings'
import Notifications from './pages/Notifications'
import Family from './pages/Family'
import { api } from './api'
import { useAppSettings } from './context/AppSettingsContext'

const SIDEBAR_COLLAPSED_KEY = 'fintrack:sidebar:collapsed'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [authPage, setAuthPage] = useState('login') // 'login' | 'register'
  const [user, setUser] = useState(null)
  const [inviteToken, setInviteToken] = useState('')
  const [resetToken, setResetToken] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1')
  const { t } = useAppSettings()

  const clearInviteTokenFromUrl = () => {
    try {
      const url = new URL(window.location.href)
      url.searchParams.delete('inviteToken')
      url.searchParams.delete('resetToken')
      const nextQuery = url.searchParams.toString()
      const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ''}${url.hash}`
      window.history.replaceState({}, '', nextUrl)
    } catch {
      // no-op
    }
  }

  useEffect(() => {
    try {
      const url = new URL(window.location.href)
      const token = String(url.searchParams.get('inviteToken') || '').trim()
      const passwordResetToken = String(url.searchParams.get('resetToken') || '').trim()
      if (token) {
        setInviteToken(token)
      }
      if (passwordResetToken) {
        setResetToken(passwordResetToken)
        setAuthPage('reset')
      }
    } catch {
      // no-op
    }

    const token = localStorage.getItem('token') || sessionStorage.getItem('token')
    const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user')
    if (token && savedUser) {
      try {
        setUser(JSON.parse(savedUser))
      } catch {
        api.clearAuthStorage()
      }
    }
  }, [])

  useEffect(() => {
    let canceled = false

    const acceptInvite = async () => {
      if (!user || !inviteToken) return

      try {
        const res = await api.post('/household/invites/accept', { token: inviteToken })
        if (canceled) return
        const householdSuffix = res?.data?.householdName ? `: ${res.data.householdName}` : ''
        toast.success(t('household.toasts.inviteAccepted', { name: householdSuffix }))
        setPage('family')
      } catch (error) {
        if (!canceled) {
          toast.error(error.message || t('household.toasts.inviteAcceptError'))
        }
      } finally {
        if (!canceled) {
          setInviteToken('')
          clearInviteTokenFromUrl()
        }
      }
    }

    acceptInvite()

    return () => {
      canceled = true
    }
  }, [user, inviteToken, t])

  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, sidebarCollapsed ? '1' : '0')
  }, [sidebarCollapsed])

  const handleLogin = (userData) => {
    setUser(userData)
    setPage('dashboard')
  }

  const handleLogout = () => {
    const refreshToken = localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken')
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }, { skipRetry: true }).catch(() => {})
    }
    api.clearAuthStorage()
    setUser(null)
    setAuthPage('login')
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', background: '#1E293B', color: '#E2E8F0', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' } }} />
        {authPage === 'login' && (
          <Login
            onLogin={handleLogin}
            onGoRegister={() => setAuthPage('register')}
            onGoForgot={() => setAuthPage('forgot')}
            invitePending={Boolean(inviteToken)}
          />
        )}
        {authPage === 'register' && (
          <Register
            onLogin={handleLogin}
            onGoLogin={() => setAuthPage('login')}
            invitePending={Boolean(inviteToken)}
          />
        )}
        {authPage === 'forgot' && (
          <ForgotPassword onGoLogin={() => setAuthPage('login')} />
        )}
        {authPage === 'reset' && (
          <ResetPassword
            token={resetToken}
            onGoLogin={() => {
              setResetToken('')
              clearInviteTokenFromUrl()
              setAuthPage('login')
            }}
          />
        )}
      </>
    )
  }

  const pages = {
    dashboard: <Dashboard navigate={setPage} user={user} />,
    accounts: <Accounts />,
    transactions: <Transactions />,
    transfers: <Transfers />,
    debts: <Debts />,
    budget: <Budget />,
    analytics: <Analytics />,
    report: <Report />,
    family: <Family user={user} />,
    notifications: <Notifications />,
    settings: <Settings user={user} onLogout={handleLogout} onUserUpdate={setUser} />,
  }

  const titles = {
    dashboard: t('app.titles.dashboard'),
    accounts: t('app.titles.accounts'),
    transactions: t('app.titles.transactions'),
    transfers: t('app.titles.transfers'),
    debts: t('app.titles.debts'),
    budget: t('app.titles.budget'),
    analytics: t('app.titles.analytics'),
    report: t('app.titles.report'),
    family: t('app.titles.family'),
    notifications: t('app.titles.notifications'),
    settings: t('app.titles.settings'),
  }

  return (
    <div className="min-h-screen bg-dark-900 text-gray-100">
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { borderRadius: '12px', background: '#1E293B', color: '#E2E8F0', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' } }} />
      <Sidebar page={page} setPage={setPage} onLogout={handleLogout} user={user} collapsed={sidebarCollapsed} />
      <main className={`min-h-screen pb-24 lg:pb-0 transition-[margin] duration-200 ease-in-out ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}`}>
        <Header
          title={titles[page] || t('app.titles.dashboard')}
          sidebarCollapsed={sidebarCollapsed}
          onToggleSidebar={() => setSidebarCollapsed((prev) => !prev)}
          onOpenNotifications={() => setPage('notifications')}
        />
        <div key={page} style={{ animation: 'slideUp 0.2s ease-out' }}>
          {pages[page] || pages.dashboard}
        </div>
      </main>
      <BottomNav page={page} setPage={setPage} />
    </div>
  )
}
