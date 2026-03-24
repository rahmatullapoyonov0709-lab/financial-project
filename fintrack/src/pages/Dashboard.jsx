import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, Wallet, Receipt, ChevronRight, ArrowLeftRight, Target, Users } from 'lucide-react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'
import { translateCategoryName } from '../utils/categoryTranslations'

const QUICK_TYPE_KEY = 'fintrack:transactions:quick-type'

export default function Dashboard({ navigate, user }) {
  const { t, formatMoney, formatNumber, theme, currency } = useAppSettings()
  const [summary, setSummary] = useState(null)
  const [chartData, setChartData] = useState([])
  const [recentTx, setRecentTx] = useState([])
  const [budgets, setBudgets] = useState([])
  const [household, setHousehold] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const base = new URLSearchParams({ baseCurrency: currency }).toString()
        const [s, p, txRes, b, householdRes] = await Promise.all([
          api.get(`/analytics/summary?${base}`),
          api.get(`/analytics/by-period?period=monthly&${base}`),
          api.get(`/transactions?limit=5&${base}`),
          api.get('/budgets'),
          api.get('/household/me'),
        ])

        setSummary(s.data)
        setChartData(p.data.slice(-12).map((d) => ({
          period: d.period,
          income: Number.parseFloat(d.income),
          expense: Number.parseFloat(d.expense),
        })))
        setRecentTx(txRes.data.transactions)
        setBudgets(b.data.budgets.slice(0, 3))
        setHousehold(householdRes.data)
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [currency])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  const isLight = theme === 'light'
  const chartGrid = isLight ? '#CBD5E1' : '#1E293B'
  const chartAxis = isLight ? '#334155' : '#475569'
  const tooltipBackground = isLight ? '#F8FAFC' : '#1E293B'
  const tooltipBorder = isLight ? '#CBD5E1' : '#334155'
  const tooltipText = isLight ? '#0F172A' : '#E2E8F0'
  const tooltipLabel = isLight ? '#334155' : '#94A3B8'

  const totalBalance = summary?.byAccount?.reduce((sum, item) => (
    sum + Number.parseFloat(item.base_balance || 0)
  ), 0) || 0
  const familyActive = Number(household?.members?.length || 0) > 1

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-400 text-sm">{t('dashboard.greeting')}</p>
          <h2 className="text-xl font-bold text-white">{user?.name}</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              localStorage.setItem(QUICK_TYPE_KEY, 'EXPENSE')
              navigate('transactions')
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-danger-500 hover:bg-danger-600 text-white rounded-lg text-xs font-medium transition-all"
          >
            <TrendingDown className="w-3.5 h-3.5" /> {t('dashboard.expenseAction')}
          </button>
          <button
            onClick={() => {
              localStorage.setItem(QUICK_TYPE_KEY, 'INCOME')
              navigate('transactions')
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg text-xs font-medium transition-all"
          >
            <TrendingUp className="w-3.5 h-3.5" /> {t('dashboard.incomeAction')}
          </button>
          <button onClick={() => navigate('transfers')} className="hidden sm:flex items-center gap-1.5 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium transition-all"><ArrowLeftRight className="w-3.5 h-3.5" /> {t('dashboard.transferAction')}</button>
        </div>
      </div>

      <div className="rounded-2xl border border-primary-500/20 bg-primary-500/8 p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/15">
              <Users className="h-5 w-5 text-primary-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {familyActive ? t('dashboard.family.activeTitle') : t('dashboard.family.personalTitle')}
              </p>
              <p className="mt-1 text-xs text-gray-400">
                {familyActive
                  ? t('dashboard.family.activeText', {
                      name: household?.household?.name || t('common.unknown'),
                      count: household?.members?.length || 0,
                    })
                  : t('dashboard.family.personalText')}
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate(familyActive ? 'family' : 'budget')}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-primary-500/30 px-4 py-2 text-sm font-medium text-primary-300 transition-colors hover:bg-primary-500/10"
          >
            {familyActive ? t('dashboard.family.openFamily') : t('dashboard.family.openBudget')}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: t('dashboard.stats.totalBalance'), value: formatMoney(totalBalance, { currency }), Icon: Wallet, tc: 'text-primary-400', bg: 'bg-primary-500/10' },
          { label: t('dashboard.stats.income'), value: formatMoney(summary?.totalIncome || 0), Icon: TrendingUp, tc: 'text-success-400', bg: 'bg-success-500/10' },
          { label: t('dashboard.stats.expense'), value: formatMoney(summary?.totalExpense || 0), Icon: TrendingDown, tc: 'text-danger-400', bg: 'bg-danger-500/10' },
          { label: t('dashboard.stats.transactions'), value: t('dashboard.stats.count', { count: formatNumber(summary?.transactionCount || 0) }), Icon: Receipt, tc: 'text-warning-400', bg: 'bg-warning-500/10' },
        ].map((item, index) => (
          <div key={index} className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4 hover:border-gray-600/50 transition-all">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}><item.Icon className={`w-4 h-4 ${item.tc}`} /></div>
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
            <p className={`text-lg font-bold font-mono ${item.tc}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
          <h3 className="font-semibold text-white mb-4">{t('dashboard.monthlyDynamics')}</h3>
          {chartData.length === 0 ? (
            <div className="h-60 flex items-center justify-center text-gray-600 text-sm">
              {t('dashboard.noTransactionsYet')}
            </div>
          ) : (
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="gi" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                    <linearGradient id="ge" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                  <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartAxis }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: chartAxis }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v)} />
                  <Tooltip
                    cursor={false}
                    contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, background: tooltipBackground, color: tooltipText, fontSize: '12px' }}
                    itemStyle={{ color: tooltipText }}
                    labelStyle={{ color: tooltipLabel }}
                    formatter={(v, n) => [formatMoney(v), n === 'income' ? t('dashboard.stats.income') : t('dashboard.stats.expense')]}
                  />
                  <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#gi)" strokeWidth={2} dot={false} />
                  <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="url(#ge)" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">{t('dashboard.accounts')}</h3>
            <button onClick={() => navigate('accounts')} className="text-xs text-primary-400 flex items-center gap-0.5 font-medium">{t('dashboard.viewAll')} <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          {summary?.byAccount?.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">{t('dashboard.noAccounts')}</div>
          ) : (
            <div className="space-y-2">
              {summary?.byAccount?.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-800/50 hover:bg-gray-700/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{account.type === 'CASH' ? '\u{1F4B5}' : account.type === 'BANK_CARD' ? '\u{1F4B3}' : '\u{1F3E6}'}</span>
                    <div>
                      <p className="text-sm font-medium text-white">{account.name}</p>
                      <span className="text-[10px] text-gray-500">{account.currency}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="block text-sm font-mono font-semibold text-white">
                      {formatMoney(account.balance, { currency: account.currency })}
                    </span>
                    {account.currency !== currency && (
                      <span className="block text-[11px] text-gray-500 font-mono">
                        {formatMoney(account.base_balance || 0, { currency })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-white">{t('dashboard.recentTransactions')}</h3>
            <button onClick={() => navigate('transactions')} className="text-xs text-primary-400 flex items-center gap-0.5 font-medium">{t('dashboard.viewAll')} <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          {recentTx.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">{t('dashboard.noTransactionsYet')}</div>
          ) : (
            <div className="space-y-1">
              {recentTx.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between p-2.5 rounded-xl hover:bg-gray-700/20 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-base" style={{ backgroundColor: (tx.category_color || '#6366F1') + '18' }}>{tx.category_icon || '\u{1F4CA}'}</div>
                    <div>
                      <p className="text-sm font-medium text-white">{translateCategoryName(tx.category_name, t)}</p>
                      <p className="text-[11px] text-gray-500">{tx.account_name}</p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold font-mono ${tx.type === 'INCOME' ? 'text-success-400' : 'text-danger-400'}`}>
                    {tx.type === 'INCOME' ? '+' : '-'}{formatMoney(tx.base_amount ?? tx.amount, { currency })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-primary-400" />
            <h3 className="font-semibold text-white">{t('dashboard.budget')}</h3>
            <button onClick={() => navigate('budget')} className="ml-auto text-xs text-primary-400 flex items-center gap-0.5 font-medium">{t('dashboard.viewAll')} <ChevronRight className="w-3.5 h-3.5" /></button>
          </div>
          {budgets.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-sm">{t('dashboard.noBudget')}</div>
          ) : (
            <div className="space-y-4">
              {budgets.map((budget) => {
                const pct = Math.min(Number.parseFloat(budget.usage_percent || 0), 100)
                const color = pct >= 90 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-success-500'
                return (
                  <div key={budget.id}>
                    <div className="flex justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-300">{budget.category_icon} {translateCategoryName(budget.category_name, t)}</span>
                      <span className={`text-xs font-bold ${pct >= 90 ? 'text-danger-400' : pct >= 70 ? 'text-warning-400' : 'text-gray-500'}`}>{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all duration-500 ${color}`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1 text-[11px] text-gray-600">
                      <span>{formatMoney(budget.spent_amount, { currency: 'UZS' })}</span>
                      <span>{formatMoney(budget.limit_amount || budget.budget, { currency: 'UZS' })}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
