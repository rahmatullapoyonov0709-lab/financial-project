import { useEffect, useMemo, useState } from 'react'
import { BellRing, Bot, Languages, LogOut, Moon, ShieldCheck, SlidersHorizontal, Sun, Trash2, UserRound, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'

const LANG_OPTIONS = ['uz', 'en', 'ru']
const CURRENCY_OPTIONS = ['UZS', 'USD', 'EUR', 'RUB']
const PERIOD_OPTIONS = ['daily', 'weekly', 'monthly', 'yearly']

const fetchPagedIds = async (path, listKey) => {
  const ids = []
  let page = 1
  const limit = 100

  while (page <= 50) {
    const separator = path.includes('?') ? '&' : '?'
    const res = await api.get(`${path}${separator}limit=${limit}&page=${page}`)
    const rows = res?.data?.[listKey] || []
    ids.push(...rows.map((item) => item.id))
    if (rows.length < limit) break
    page += 1
  }

  return ids
}

function ToggleSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500/40 ${
        checked
          ? 'bg-primary-500/90 border-primary-400 shadow-[0_0_0_3px_rgba(99,102,241,0.15)]'
          : 'bg-gray-700/60 border-gray-500/70 hover:bg-gray-700/80'
      }`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ${
          checked ? 'translate-x-5' : 'translate-x-1'
        }`}
      />
    </button>
  )
}

export default function Settings({ user, onLogout, onUserUpdate }) {
  const {
    t,
    settings,
    setLanguage,
    setCurrency,
    setTheme,
    setNotification,
  } = useAppSettings()

  const [activeSection, setActiveSection] = useState('profile')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [clearing, setClearing] = useState(false)

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  })
  const [profileSaving, setProfileSaving] = useState(false)

  const [passwordForm, setPasswordForm] = useState({
    current: '',
    next: '',
    confirm: '',
  })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiSaving, setAiSaving] = useState(false)
  const [aiSending, setAiSending] = useState(false)
  const [aiSettings, setAiSettings] = useState({
    enabled: false,
    reportPeriod: 'daily',
    deliveryTime: '21:00',
    timezone: 'Asia/Tashkent',
    language: settings.language || 'uz',
    apiConfigured: false,
  })

  const sectionItems = useMemo(() => ([
    { id: 'profile', label: t('settings.sections.profile'), icon: UserRound },
    { id: 'personalization', label: t('settings.sections.personalization'), icon: SlidersHorizontal },
    { id: 'aiReports', label: t('settings.sections.aiReports'), icon: Bot },
    { id: 'notifications', label: t('settings.sections.notifications'), icon: BellRing },
    { id: 'security', label: t('settings.sections.security'), icon: ShieldCheck },
  ]), [t])

  const notificationItems = useMemo(() => ([
    { key: 'budgetWarning', label: t('settings.notifications.budgetWarning') },
    { key: 'highSpendingAlert', label: t('settings.notifications.highSpending') },
    { key: 'monthlyReportReminder', label: t('settings.notifications.monthlyReminder') },
  ]), [t])

  useEffect(() => {
    setProfileForm({
      name: user?.name || '',
      email: user?.email || '',
    })
  }, [user?.name, user?.email])

  useEffect(() => {
    let canceled = false

    const loadMe = async () => {
      try {
        const res = await api.get('/auth/me')
        if (canceled) return
        const me = res?.data || {}
        setProfileForm({
          name: me.name || user?.name || '',
          email: me.email || user?.email || '',
        })
      } catch {
        if (!canceled) {
          toast.error(t('settings.profile.loadError'))
        }
      }
    }

    loadMe()

    return () => {
      canceled = true
    }
  }, [t])

  useEffect(() => {
    let canceled = false

    const loadAiSettings = async () => {
      setAiLoading(true)
      try {
        const res = await api.get('/ai/settings')
        if (canceled) return

        const data = res?.data || {}
        setAiSettings((prev) => ({
          ...prev,
          enabled: Boolean(data.enabled),
          reportPeriod: data.reportPeriod || prev.reportPeriod,
          deliveryTime: data.deliveryTime || prev.deliveryTime,
          timezone: data.timezone || prev.timezone,
          language: data.language || settings.language || prev.language,
          apiConfigured: Boolean(data.apiConfigured),
        }))
      } catch (error) {
        if (!canceled) {
          toast.error(error.message || t('settings.aiReports.loadError'))
        }
      } finally {
        if (!canceled) {
          setAiLoading(false)
        }
      }
    }

    loadAiSettings()

    return () => {
      canceled = true
    }
  }, [settings.language, t])

  const handleProfileSave = async () => {
    const name = profileForm.name.trim()
    const email = profileForm.email.trim()

    if (!name || !email) {
      toast.error(t('settings.profile.required'))
      return
    }

    setProfileSaving(true)
    try {
      const res = await api.put('/auth/me', { name, email })
      const data = res?.data || {}
      const updatedUser = {
        ...(user || {}),
        id: data.id || user?.id,
        name: data.name || name,
        email: data.email || email,
        createdAt: data.created_at || data.createdAt || user?.createdAt,
      }
      if (localStorage.getItem('token')) {
        localStorage.setItem('user', JSON.stringify(updatedUser))
      } else {
        sessionStorage.setItem('user', JSON.stringify(updatedUser))
      }
      onUserUpdate?.(updatedUser)
      toast.success(t('settings.profile.saved'))
    } catch (error) {
      toast.error(error.message || t('settings.profile.loadError'))
    } finally {
      setProfileSaving(false)
    }
  }

  const handlePasswordSave = async () => {
    if (!passwordForm.current || !passwordForm.next || !passwordForm.confirm) {
      toast.error(t('settings.password.required'))
      return
    }
    if (passwordForm.next !== passwordForm.confirm) {
      toast.error(t('settings.password.mismatch'))
      return
    }

    setPasswordSaving(true)
    try {
      await api.put('/auth/password', {
        currentPassword: passwordForm.current,
        newPassword: passwordForm.next,
      })
      setPasswordForm({ current: '', next: '', confirm: '' })
      toast.success(t('settings.password.updated'))
    } catch (error) {
      toast.error(error.message || t('auth.error'))
    } finally {
      setPasswordSaving(false)
    }
  }

  const handleSaveAiSettings = async () => {
    setAiSaving(true)
    try {
      const payload = {
        enabled: Boolean(aiSettings.enabled),
        reportPeriod: aiSettings.reportPeriod,
        deliveryTime: aiSettings.deliveryTime,
        timezone: aiSettings.timezone.trim() || 'Asia/Tashkent',
        language: aiSettings.language,
      }
      const res = await api.put('/ai/settings', payload)
      const data = res?.data || {}
      setAiSettings((prev) => ({
        ...prev,
        enabled: Boolean(data.enabled),
        reportPeriod: data.reportPeriod || prev.reportPeriod,
        deliveryTime: data.deliveryTime || prev.deliveryTime,
        timezone: data.timezone || prev.timezone,
        language: data.language || prev.language,
        apiConfigured: Boolean(data.apiConfigured),
      }))
      toast.success(t('settings.aiReports.saved'))
    } catch (error) {
      toast.error(error.message || t('settings.aiReports.loadError'))
    } finally {
      setAiSaving(false)
    }
  }

  const handleSendAiReportNow = async () => {
    setAiSending(true)
    try {
      const res = await api.post('/ai/reports/send-now', {
        reportPeriod: aiSettings.reportPeriod,
        timezone: aiSettings.timezone?.trim() || 'Asia/Tashkent',
        language: aiSettings.language,
      })
      const data = res?.data || {}
      if (data.sent) {
        toast.success(t('settings.aiReports.sentNow'))
      } else {
        toast.success(t('settings.aiReports.sentSkipped'))
      }
    } catch (error) {
      toast.error(error.message || t('settings.aiReports.loadError'))
    } finally {
      setAiSending(false)
    }
  }

  const clearAllData = async () => {
    setClearing(true)
    try {
      const [transactionIds, transferIds, debtRes, budgetRes, accountRes] = await Promise.all([
        fetchPagedIds('/transactions', 'transactions'),
        fetchPagedIds('/transfers', 'transfers'),
        api.get('/debts'),
        api.get('/budgets'),
        api.get('/accounts'),
      ])

      const debtIds = (debtRes?.data?.debts || []).map((item) => item.id)
      const budgetIds = (budgetRes?.data?.budgets || []).map((item) => item.id)
      const accountIds = (accountRes?.data?.accounts || []).map((item) => item.id)

      for (const id of budgetIds) await api.delete(`/budgets/${id}`)
      for (const id of transferIds) await api.delete(`/transfers/${id}`)
      for (const id of transactionIds) await api.delete(`/transactions/${id}`)
      for (const id of debtIds) await api.delete(`/debts/${id}`)
      for (const id of accountIds) await api.delete(`/accounts/${id}`)

      setConfirmOpen(false)
      toast.success(t('settings.cleared'))
    } catch (error) {
      toast.error(error.message || t('settings.clearFailed'))
    } finally {
      setClearing(false)
    }
  }

  const cardClass = 'bg-dark-800 rounded-2xl border border-gray-700/50 p-5'

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className={cardClass}>
        <h2 className="text-lg font-semibold text-white">{t('settings.title')}</h2>
        <p className="text-sm text-gray-400 mt-1">{t('settings.description')}</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[260px_1fr] gap-4">
        <aside className={cardClass}>
          <nav className="space-y-1">
            {sectionItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveSection(item.id)}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${activeSection === item.id ? 'bg-primary-500/10 border border-primary-500/30 text-primary-400' : 'text-gray-300 hover:bg-gray-700/30'}`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="space-y-4">
          {activeSection === 'profile' && (
            <>
              <div className={cardClass}>
                <h3 className="text-base font-semibold text-white">{t('settings.profile.title')}</h3>
                <p className="text-sm text-gray-400 mt-1">{t('settings.profile.description')}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.profile.username')}</label>
                    <input
                      type="text"
                      value={profileForm.name}
                      placeholder={t('settings.profile.usernamePlaceholder')}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))}
                      className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.profile.email')}</label>
                    <input
                      type="email"
                      value={profileForm.email}
                      placeholder={t('settings.profile.emailPlaceholder')}
                      onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))}
                      className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                    />
                  </div>
                </div>

                <button
                  onClick={handleProfileSave}
                  disabled={profileSaving}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {profileSaving ? t('common.loading') : t('settings.profile.save')}
                </button>
              </div>

              <div className={cardClass}>
                <h3 className="text-base font-semibold text-white">{t('settings.account.title')}</h3>
                <p className="text-sm text-gray-400 mt-1">{t('settings.account.description')}</p>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="rounded-xl border border-gray-700/60 px-3 py-2.5">
                    <p className="text-xs text-gray-500 mb-1">{t('settings.account.name')}</p>
                    <p className="text-gray-100">{user?.name || t('common.unknown')}</p>
                  </div>
                  <div className="rounded-xl border border-gray-700/60 px-3 py-2.5">
                    <p className="text-xs text-gray-500 mb-1">{t('settings.account.email')}</p>
                    <p className="text-gray-100 break-all">{user?.email || t('common.unknown')}</p>
                  </div>
                </div>
                <button onClick={onLogout} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-danger-500/10 border border-danger-500/30 text-danger-400 hover:bg-danger-500/20 transition-colors">
                  <LogOut className="w-4 h-4" />
                  {t('settings.account.logout')}
                </button>
                <div className="mt-5 border-t border-danger-500/20 pt-5">
                  <h4 className="text-sm font-semibold text-danger-400">{t('settings.sections.danger')}</h4>
                  <p className="mt-1 text-sm text-gray-400">{t('settings.danger.hint')}</p>
                  <button onClick={() => setConfirmOpen(true)} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-danger-500 text-white hover:bg-danger-600 transition-colors">
                    <Trash2 className="w-4 h-4" />
                    {t('settings.danger.clearAll')}
                  </button>
                </div>
              </div>
            </>
          )}

          {activeSection === 'personalization' && (
            <div className={cardClass}>
              <h3 className="text-base font-semibold text-white">{t('settings.sections.personalization')}</h3>
              <p className="text-sm text-gray-400 mt-1">{t('settings.description')}</p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Languages className="w-4 h-4 text-primary-400" />
                    <span className="text-sm font-medium text-gray-200">{t('settings.sections.language')}</span>
                  </div>
                  <div className="space-y-2">
                    {LANG_OPTIONS.map((option) => (
                      <button key={option} onClick={() => setLanguage(option)} className={`w-full px-3 py-2 rounded-xl text-sm border transition-colors ${settings.language === option ? 'border-primary-500 bg-primary-500/10 text-primary-400' : 'border-gray-700 text-gray-300 hover:bg-gray-700/25'}`}>
                        {t(`language.${option}`)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-success-400" />
                    <span className="text-sm font-medium text-gray-200">{t('settings.sections.currency')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {CURRENCY_OPTIONS.map((option) => (
                      <button key={option} onClick={() => setCurrency(option)} className={`px-3 py-2 rounded-xl text-sm border transition-colors ${settings.currency === option ? 'border-success-500 bg-success-500/10 text-success-400' : 'border-gray-700 text-gray-300 hover:bg-gray-700/25'}`}>
                        {option}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 mb-2">
                    {settings.theme === 'dark' ? <Moon className="w-4 h-4 text-primary-400" /> : <Sun className="w-4 h-4 text-warning-500" />}
                    <span className="text-sm font-medium text-gray-200">{t('settings.sections.theme')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setTheme('dark')} className={`px-3 py-2 rounded-xl text-sm border transition-colors ${settings.theme === 'dark' ? 'border-primary-500 bg-primary-500/10 text-primary-400' : 'border-gray-700 text-gray-300 hover:bg-gray-700/25'}`}>
                      {t('theme.dark')}
                    </button>
                    <button onClick={() => setTheme('light')} className={`px-3 py-2 rounded-xl text-sm border transition-colors ${settings.theme === 'light' ? 'border-warning-500 bg-warning-500/10 text-warning-500' : 'border-gray-700 text-gray-300 hover:bg-gray-700/25'}`}>
                      {t('theme.light')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'notifications' && (
            <div className={cardClass}>
              <h3 className="text-base font-semibold text-white">{t('settings.sections.notifications')}</h3>
              <p className="text-sm text-gray-400 mt-1">{t('settings.description')}</p>

              <div className="space-y-2 mt-4">
                {notificationItems.map((item) => (
                  <label key={item.key} className="flex items-center justify-between rounded-xl border border-gray-700/60 px-3 py-2.5">
                    <span className="text-sm text-gray-200">{item.label}</span>
                    <ToggleSwitch checked={Boolean(settings.notifications[item.key])} onChange={(next) => setNotification(item.key, next)} label={item.label} />
                  </label>
                ))}
              </div>
            </div>
          )}

          {activeSection === 'aiReports' && (
            <div className={cardClass}>
              <h3 className="text-base font-semibold text-white">{t('settings.aiReports.title')}</h3>
              <p className="text-sm text-gray-400 mt-1">{t('settings.aiReports.description')}</p>

              {!aiSettings.apiConfigured && (
                <div className="mt-4 rounded-xl border border-warning-500/30 bg-warning-500/10 px-3 py-2 text-xs text-warning-500">
                  {t('settings.aiReports.apiMissing')}
                </div>
              )}

              {aiLoading ? (
                <div className="mt-4 text-sm text-gray-400">{t('common.loading')}</div>
              ) : (
                <div className="mt-4 space-y-4">
                  <label className="flex items-center justify-between rounded-xl border border-gray-700/60 px-3 py-2.5">
                    <span className="text-sm text-gray-200">{t('settings.aiReports.enabled')}</span>
                    <ToggleSwitch
                      checked={Boolean(aiSettings.enabled)}
                      onChange={(next) => setAiSettings((prev) => ({ ...prev, enabled: next }))}
                      label={t('settings.aiReports.enabled')}
                    />
                  </label>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.aiReports.period')}</label>
                      <select
                        value={aiSettings.reportPeriod}
                        onChange={(e) => setAiSettings((prev) => ({ ...prev, reportPeriod: e.target.value }))}
                        className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      >
                        {PERIOD_OPTIONS.map((periodItem) => (
                          <option key={periodItem} value={periodItem}>{t(`report.periods.${periodItem}`)}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.aiReports.time')}</label>
                      <input
                        type="time"
                        value={aiSettings.deliveryTime}
                        onChange={(e) => setAiSettings((prev) => ({ ...prev, deliveryTime: e.target.value }))}
                        className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.aiReports.timezone')}</label>
                      <input
                        type="text"
                        value={aiSettings.timezone}
                        onChange={(e) => setAiSettings((prev) => ({ ...prev, timezone: e.target.value }))}
                        className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.aiReports.language')}</label>
                      <select
                        value={aiSettings.language}
                        onChange={(e) => setAiSettings((prev) => ({ ...prev, language: e.target.value }))}
                        className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                      >
                        {LANG_OPTIONS.map((languageCode) => (
                          <option key={languageCode} value={languageCode}>{t(`language.${languageCode}`)}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleSaveAiSettings}
                    disabled={aiSaving}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {aiSaving ? t('common.loading') : t('settings.aiReports.save')}
                  </button>

                  <button
                    onClick={handleSendAiReportNow}
                    disabled={aiSending || !aiSettings.enabled}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-700 text-gray-200 hover:bg-gray-700/40 text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    {aiSending ? t('common.loading') : t('settings.aiReports.sendNow')}
                  </button>
                </div>
              )}
            </div>
          )}

          {activeSection === 'security' && (
            <div className={cardClass}>
              <h3 className="text-base font-semibold text-white">{t('settings.password.title')}</h3>
              <p className="text-sm text-gray-400 mt-1">{t('settings.password.description')}</p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.password.current')}</label>
                  <input type="password" value={passwordForm.current} onChange={(e) => setPasswordForm((prev) => ({ ...prev, current: e.target.value }))} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.password.next')}</label>
                  <input type="password" value={passwordForm.next} onChange={(e) => setPasswordForm((prev) => ({ ...prev, next: e.target.value }))} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('settings.password.confirm')}</label>
                  <input type="password" value={passwordForm.confirm} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirm: e.target.value }))} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
              </div>

              <button onClick={handlePasswordSave} disabled={passwordSaving} className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                {passwordSaving ? t('common.loading') : t('settings.password.save')}
              </button>
            </div>
          )}

        </section>
      </div>

      {confirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-dark-800 border border-gray-700 rounded-2xl p-5">
            <h4 className="text-base font-semibold text-white">{t('settings.danger.confirmTitle')}</h4>
            <p className="text-sm text-gray-400 mt-2">{t('settings.danger.confirmText')}</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button onClick={() => setConfirmOpen(false)} disabled={clearing} className="px-3 py-2 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-700/40 transition-colors disabled:opacity-50">
                {t('common.cancel')}
              </button>
              <button onClick={clearAllData} disabled={clearing} className="px-3 py-2 rounded-xl bg-danger-500 text-white hover:bg-danger-600 transition-colors disabled:opacity-50">
                {clearing ? t('common.loading') : t('settings.danger.confirmAction')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
