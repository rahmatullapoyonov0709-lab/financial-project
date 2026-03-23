import { useState } from 'react'
import { KeyRound, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'

export default function ResetPassword({ token, onGoLogin }) {
  const { t } = useAppSettings()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!password || !confirm) {
      toast.error(t('auth.reset.required'))
      return
    }
    if (password.length < 6) {
      toast.error(t('auth.register.toasts.minPassword'))
      return
    }
    if (password !== confirm) {
      toast.error(t('settings.password.mismatch'))
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/reset-password', { token, newPassword: password })
      toast.success(res.message || t('auth.reset.success'))
      onGoLogin?.()
    } catch (error) {
      toast.error(error.message || t('auth.error'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-900 px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-5xl items-center">
        <div className="grid w-full gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="hidden rounded-[2rem] border border-primary-500/20 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.18),transparent_35%),linear-gradient(180deg,#0f172a,#020617)] p-8 lg:block">
            <p className="inline-flex rounded-full border border-success-500/20 bg-success-500/10 px-3 py-1 text-xs font-medium text-success-400">
              FinTrack Access Recovery
            </p>
            <h1 className="mt-6 text-4xl font-bold text-white">{t('auth.reset.title')}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-gray-300">{t('auth.reset.description')}</p>
          </div>

          <div className="rounded-[2rem] border border-gray-700/60 bg-dark-800 p-6 shadow-2xl shadow-black/30 lg:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-success-500/10">
              <KeyRound className="h-6 w-6 text-success-400" />
            </div>

            <div className="mt-6">
              <h2 className="text-2xl font-semibold text-white">{t('auth.reset.heading')}</h2>
              <p className="mt-2 text-sm text-gray-400">{t('auth.reset.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">{t('settings.password.next')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="w-full rounded-2xl border border-gray-700 bg-dark-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">{t('settings.password.confirm')}</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    className="w-full rounded-2xl border border-gray-700 bg-dark-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60">
                {loading ? t('common.loading') : t('auth.reset.submit')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
