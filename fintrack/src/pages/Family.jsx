import { useEffect, useState } from 'react'
import { ArrowUpDown, BarChart3, Copy, Crown, FileText, KeyRound, LogIn, PiggyBank, Receipt, RefreshCcw, ShieldCheck, TrendingDown, TrendingUp, UserMinus, Users, Wallet } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'
import { translateCategoryName } from '../utils/categoryTranslations'

const sharedItems = [
  { icon: Wallet, key: 'accounts', color: 'text-primary-400' },
  { icon: ArrowUpDown, key: 'transactions', color: 'text-primary-300' },
  { icon: BarChart3, key: 'analytics', color: 'text-success-400' },
  { icon: FileText, key: 'report', color: 'text-success-300' },
  { icon: PiggyBank, key: 'budget', color: 'text-warning-500' },
  { icon: Receipt, key: 'debts', color: 'text-danger-400' },
]

const localeMap = {
  uz: 'uz-UZ',
  en: 'en-US',
  ru: 'ru-RU',
}

export default function Family({ user }) {
  const { t, language, formatMoney } = useAppSettings()
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copying, setCopying] = useState(false)
  const [removingMemberId, setRemovingMemberId] = useState('')
  const [joinCodeInput, setJoinCodeInput] = useState('')
  const [family, setFamily] = useState({
    household: null,
    members: [],
    myRole: 'MEMBER',
    isOwner: false,
  })
  const [sharedOverview, setSharedOverview] = useState({
    totalBalance: 0,
    totalIncome: 0,
    totalExpense: 0,
    budgets: [],
  })

  const loadFamily = async ({ silent = false } = {}) => {
    if (!silent) {
      setLoading(true)
    }

    try {
      const [familyRes, summaryRes, budgetRes] = await Promise.all([
        api.get('/household/me'),
        api.get('/analytics/summary'),
        api.get('/budgets'),
      ])

      const data = familyRes?.data || {}
      const summary = summaryRes?.data || {}
      const budgets = Array.isArray(budgetRes?.data?.budgets) ? budgetRes.data.budgets : []
      const totalBalance = Array.isArray(summary.byAccount)
        ? summary.byAccount.reduce((sum, item) => (
            item.currency === 'UZS' ? sum + Number.parseFloat(item.balance || 0) : sum
          ), 0)
        : 0

      setFamily({
        household: data.household || null,
        members: Array.isArray(data.members) ? data.members : [],
        myRole: data.myRole || 'MEMBER',
        isOwner: Boolean(data.isOwner),
      })
      setSharedOverview({
        totalBalance,
        totalIncome: Number(summary.totalIncome || 0),
        totalExpense: Number(summary.totalExpense || 0),
        budgets: budgets.slice(0, 4),
      })
    } catch (error) {
      toast.error(error.message || t('settings.family.loadError'))
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    loadFamily()

    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadFamily({ silent: true })
      }
    }

    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)

    return () => {
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  const handleJoinByCode = async () => {
    const code = joinCodeInput.trim()
    if (!code) {
      toast.error(t('settings.family.joinCodeRequired'))
      return
    }

    setJoining(true)
    try {
      await api.post('/household/join-by-code', { code })
      toast.success(t('settings.family.joinSuccess'))
      setJoinCodeInput('')
      await loadFamily({ silent: true })
    } catch (error) {
      toast.error(error.message || t('settings.family.joinError'))
    } finally {
      setJoining(false)
    }
  }

  const handleRegenerateJoinCode = async () => {
    setRegenerating(true)
    try {
      const res = await api.post('/household/join-code/regenerate', {})
      const nextCode = res?.data?.joinCode || ''
      setFamily((prev) => ({
        ...prev,
        household: prev.household ? { ...prev.household, joinCode: nextCode } : prev.household,
      }))
      toast.success(t('settings.family.codeRegenerated'))
    } catch (error) {
      toast.error(error.message || t('settings.family.codeRegenerateError'))
    } finally {
      setRegenerating(false)
    }
  }

  const handleCopyJoinCode = async () => {
    const code = family.household?.joinCode
    if (!code || !navigator?.clipboard?.writeText) {
      return
    }

    setCopying(true)
    try {
      await navigator.clipboard.writeText(code)
      toast.success(t('settings.family.codeCopied'))
    } catch {
      toast.error(t('settings.family.copyError'))
    } finally {
      setCopying(false)
    }
  }

  const handleRemoveMember = async (targetUserId) => {
    setRemovingMemberId(targetUserId)
    try {
      await api.delete(`/household/members/${targetUserId}`)
      toast.success(t('settings.family.memberRemoved'))
      await loadFamily({ silent: true })
    } catch (error) {
      toast.error(error.message || t('settings.family.removeError'))
    } finally {
      setRemovingMemberId('')
    }
  }

  const formatDate = (value) => {
    if (!value) {
      return t('common.unknown')
    }

    try {
      return new Intl.DateTimeFormat(localeMap[language] || localeMap.uz, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      }).format(new Date(value))
    } catch {
      return t('common.unknown')
    }
  }

  const canJoinAnotherHousehold = !family.isOwner || family.members.length <= 1
  const isSolo = family.members.length <= 1
  const familyActive = family.members.length > 1
  const cardClass = 'rounded-2xl border border-gray-700/50 bg-dark-800 p-5'

  if (loading) {
    return (
      <div className="p-4 lg:p-6">
        <div className={cardClass}>
          <p className="text-sm text-gray-400">{t('common.loading')}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <section className="rounded-3xl border border-primary-500/20 bg-[radial-gradient(circle_at_top_left,rgba(99,102,241,0.18),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.95),rgba(15,23,42,0.9))] p-5 lg:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-500/20 bg-primary-500/10 px-3 py-1 text-xs font-medium text-primary-300">
              <Users className="h-3.5 w-3.5" />
              {t('settings.family.title')}
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white">{family.household?.name || t('common.unknown')}</h2>
            <p className="mt-2 max-w-2xl text-sm text-gray-300">{t('familyPage.subtitle')}</p>
          </div>

          <button
            type="button"
            onClick={() => loadFamily()}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-gray-600/60 bg-dark-900/70 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:border-primary-500/40 hover:text-white"
          >
            <RefreshCcw className="h-4 w-4" />
            {t('familyPage.refresh')}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-gray-700/50 bg-dark-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{t('familyPage.myRole')}</p>
            <div className="mt-2 flex items-center gap-2 text-white">
              {family.isOwner ? <Crown className="h-4 w-4 text-warning-500" /> : <ShieldCheck className="h-4 w-4 text-primary-400" />}
              <span className="text-sm font-medium">{family.isOwner ? t('settings.family.roleOwner') : t('settings.family.roleMember')}</span>
            </div>
          </div>
          <div className="rounded-2xl border border-gray-700/50 bg-dark-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{t('familyPage.memberCount')}</p>
            <p className="mt-2 text-xl font-semibold text-white">{family.members.length}</p>
          </div>
          <div className="rounded-2xl border border-gray-700/50 bg-dark-900/60 p-4">
            <p className="text-xs uppercase tracking-[0.18em] text-gray-500">{t('familyPage.createdAt')}</p>
            <p className="mt-2 text-sm font-medium text-white">{formatDate(family.household?.createdAt)}</p>
          </div>
        </div>
      </section>

      {isSolo && (
        <section className={cardClass}>
          <h3 className="text-base font-semibold text-white">{t('familyPage.soloTitle')}</h3>
          <p className="mt-2 text-sm text-gray-400">{t('familyPage.soloDescription')}</p>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={cardClass}>
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold text-white">
              {familyActive ? t('dashboard.family.activeTitle') : t('dashboard.family.personalTitle')}
            </h3>
            <p className="text-sm text-gray-400">
              {familyActive
                ? t('dashboard.family.activeText', {
                    name: family.household?.name || t('common.unknown'),
                    count: family.members.length,
                  })
                : t('dashboard.family.personalText')}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              {
                key: 'balance',
                label: t('dashboard.stats.totalBalance'),
                value: formatMoney(sharedOverview.totalBalance, { currency: 'UZS' }),
                icon: Wallet,
                iconClass: 'text-primary-300',
                bgClass: 'bg-primary-500/10',
              },
              {
                key: 'income',
                label: t('dashboard.stats.income'),
                value: formatMoney(sharedOverview.totalIncome),
                icon: TrendingUp,
                iconClass: 'text-success-400',
                bgClass: 'bg-success-500/10',
              },
              {
                key: 'expense',
                label: t('dashboard.stats.expense'),
                value: formatMoney(sharedOverview.totalExpense),
                icon: TrendingDown,
                iconClass: 'text-danger-400',
                bgClass: 'bg-danger-500/10',
              },
              {
                key: 'budget',
                label: t('app.titles.budget'),
                value: String(sharedOverview.budgets.length),
                icon: PiggyBank,
                iconClass: 'text-warning-500',
                bgClass: 'bg-warning-500/10',
              },
            ].map((item) => (
              <div key={item.key} className="rounded-2xl border border-gray-700/50 bg-dark-900/60 p-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${item.bgClass}`}>
                  <item.icon className={`h-5 w-5 ${item.iconClass}`} />
                </div>
                <p className="mt-3 text-xs text-gray-500">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-white">{item.value}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <div className="flex items-center gap-2">
            <PiggyBank className="h-4 w-4 text-warning-500" />
            <h3 className="text-base font-semibold text-white">{t('app.titles.budget')}</h3>
          </div>
          <p className="mt-2 text-sm text-gray-400">{t('familyPage.sharedDescription')}</p>

          {sharedOverview.budgets.length === 0 ? (
            <div className="mt-4 rounded-2xl border border-gray-700/50 bg-dark-900/60 p-4 text-sm text-gray-500">
              {t('budget.empty')}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {sharedOverview.budgets.map((budget) => {
                const pct = Math.min(Number.parseFloat(budget.usage_percent || 0), 100)
                const color = pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-success-500'

                return (
                  <div key={budget.id} className="rounded-2xl border border-gray-700/50 bg-dark-900/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-white">
                        {budget.category_icon} {translateCategoryName(budget.category_name, t)}
                      </p>
                      <span className="text-xs font-semibold text-gray-400">{pct}%</span>
                    </div>
                    <div className="mt-3 h-2 rounded-full bg-gray-700">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                      <span>{formatMoney(budget.spent_amount, { currency: 'UZS' })}</span>
                      <span>{formatMoney(budget.limit_amount, { currency: 'UZS' })}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={cardClass}>
          <h3 className="text-base font-semibold text-white">{t('familyPage.sharedTitle')}</h3>
          <p className="mt-2 text-sm text-gray-400">{t('familyPage.sharedDescription')}</p>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {sharedItems.map((item) => (
              <div key={item.key} className="rounded-2xl border border-gray-700/50 bg-dark-900/60 px-4 py-3">
                <div className="flex items-center gap-2">
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="text-sm font-medium text-gray-100">{t(`familyPage.sharedItems.${item.key}`)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={cardClass}>
          <h3 className="text-base font-semibold text-white">{t('settings.family.joinByCodeTitle')}</h3>
          <p className="mt-2 text-sm text-gray-400">
            {canJoinAnotherHousehold ? t('familyPage.joinMoveHint') : t('familyPage.ownerLockedHint')}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <input
              type="text"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value)}
              placeholder={t('settings.family.joinCodePlaceholder')}
              disabled={!canJoinAnotherHousehold}
              className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={handleJoinByCode}
              disabled={joining || !canJoinAnotherHousehold}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <LogIn className="h-4 w-4" />
              {joining ? t('common.loading') : t('settings.family.joinAction')}
            </button>
          </div>
        </div>
      </section>

      {family.isOwner && (
        <section className={cardClass}>
          <h3 className="text-base font-semibold text-white">{t('settings.family.joinCodeTitle')}</h3>
          <p className="mt-2 text-sm text-gray-400">{t('settings.family.joinCodeHint')}</p>

          <div className="mt-4 flex flex-col gap-2 lg:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-gray-700 bg-dark-900 px-3 py-2.5 text-sm text-gray-100">
              <KeyRound className="h-4 w-4 shrink-0 text-primary-400" />
              <span className="break-all">{family.household?.joinCode || t('common.unknown')}</span>
            </div>
            <button
              type="button"
              onClick={handleCopyJoinCode}
              disabled={copying || !family.household?.joinCode}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary-500/30 px-4 py-2.5 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Copy className="h-4 w-4" />
              {copying ? t('common.loading') : t('settings.family.copyCode')}
            </button>
            <button
              type="button"
              onClick={handleRegenerateJoinCode}
              disabled={regenerating}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-warning-500/30 px-4 py-2.5 text-sm font-medium text-warning-500 transition-colors hover:bg-warning-500/10 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCcw className={`h-4 w-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? t('common.loading') : t('settings.family.regenerateCode')}
            </button>
          </div>
        </section>
      )}

      <section className={cardClass}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold text-white">{t('settings.family.membersTitle')}</h3>
            <p className="mt-1 text-sm text-gray-400">{t('familyPage.membersDescription')}</p>
          </div>
          <div className="rounded-full border border-gray-700/60 px-3 py-1 text-xs font-medium text-gray-300">
            {family.members.length} {t('familyPage.memberCount')}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {family.members.length === 0 ? (
            <p className="text-sm text-gray-500">{t('settings.family.noMembers')}</p>
          ) : (
            family.members.map((member) => (
              <div key={member.userId} className="flex flex-col gap-3 rounded-2xl border border-gray-700/40 bg-dark-900/60 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-gray-100">{member.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] ${member.role === 'OWNER' ? 'bg-warning-500/15 text-warning-500' : 'bg-primary-500/10 text-primary-300'}`}>
                      {member.role === 'OWNER' ? t('settings.family.roleOwner') : t('settings.family.roleMember')}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs text-gray-500">{member.email}</p>
                  <p className="mt-1 text-xs text-gray-500">{formatDate(member.joinedAt)}</p>
                </div>

                {family.isOwner && member.role !== 'OWNER' && member.userId !== user?.id && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.userId)}
                    disabled={removingMemberId === member.userId}
                    className="inline-flex items-center gap-2 self-start rounded-xl border border-danger-500/30 px-3 py-2 text-xs font-medium text-danger-400 transition-colors hover:bg-danger-500/10 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    {removingMemberId === member.userId ? t('common.loading') : t('settings.family.removeAction')}
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
