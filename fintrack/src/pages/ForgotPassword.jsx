import { useState } from 'react'
import { ArrowLeft, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'

export default function ForgotPassword({ onGoLogin }) {
  const { t } = useAppSettings()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (!email.trim()) {
      toast.error(t('auth.forgot.required'))
      return
    }

    setLoading(true)
    try {
      const res = await api.post('/auth/forgot-password', { email })
      toast.success(res.message || t('auth.forgot.sent'))
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
          <div className="hidden rounded-[2rem] border border-primary-500/20 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.2),transparent_40%),linear-gradient(180deg,#0f172a,#020617)] p-8 lg:block">
            <p className="inline-flex rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-300">
              FinTrack Security
            </p>
            <h1 className="mt-6 text-4xl font-bold text-white">{t('auth.forgot.title')}</h1>
            <p className="mt-4 max-w-md text-sm leading-7 text-gray-300">{t('auth.forgot.description')}</p>
          </div>

          <div className="rounded-[2rem] border border-gray-700/60 bg-dark-800 p-6 shadow-2xl shadow-black/30 lg:p-8">
            <button onClick={onGoLogin} className="inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              {t('auth.forgot.back')}
            </button>

            <div className="mt-8">
              <h2 className="text-2xl font-semibold text-white">{t('auth.forgot.heading')}</h2>
              <p className="mt-2 text-sm text-gray-400">{t('auth.forgot.subtitle')}</p>
            </div>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-300">{t('auth.login.email')}</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="email@example.com"
                    className="w-full rounded-2xl border border-gray-700 bg-dark-900 py-3 pl-10 pr-4 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full rounded-2xl bg-primary-500 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary-600 disabled:opacity-60">
                {loading ? t('common.loading') : t('auth.forgot.submit')}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}
