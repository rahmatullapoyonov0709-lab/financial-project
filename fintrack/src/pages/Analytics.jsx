import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import { AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'
import { translateCategoryName } from '../utils/categoryTranslations'

const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F43F5E', '#F97316', '#10B981', '#3B82F6', '#9E9E9E']

export default function Analytics() {
  const { t, formatMoney, theme, currency } = useAppSettings()
  const [period, setPeriod] = useState('monthly')
  const [summary, setSummary] = useState(null)
  const [byCategory, setByCategory] = useState([])
  const [byPeriod, setByPeriod] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const base = new URLSearchParams({ baseCurrency: currency }).toString()
        const [s, c, p] = await Promise.all([
          api.get(`/analytics/summary?${base}`),
          api.get(`/analytics/by-category?type=EXPENSE&${base}`),
          api.get(`/analytics/by-period?period=${period}&${base}`),
        ])
        setSummary(s.data)
        setByCategory(c.data.slice(0, 8))
        setByPeriod(p.data.slice(-20).map((d) => ({
          period: d.period,
          income: Number.parseFloat(d.income),
          expense: Number.parseFloat(d.expense),
        })))
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [period, currency])

  if (loading) return <div className="p-6 flex justify-center"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>

  const isLight = theme === 'light'
  const chartGrid = isLight ? '#CBD5E1' : '#1E293B'
  const chartAxis = isLight ? '#334155' : '#475569'
  const tooltipBackground = isLight ? '#F8FAFC' : '#1E293B'
  const tooltipBorder = isLight ? '#CBD5E1' : '#334155'
  const tooltipText = isLight ? '#0F172A' : '#E2E8F0'
  const tooltipLabel = isLight ? '#334155' : '#94A3B8'

  const pieData = byCategory.map((c, i) => ({
    name: translateCategoryName(c.name, t),
    value: Number.parseFloat(c.total),
    icon: c.icon,
    color: COLORS[i],
  }))

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: t('analytics.cards.income'), value: formatMoney(summary?.totalIncome || 0), Icon: TrendingUp, c: 'text-success-400', bg: 'bg-success-500/10' },
          { label: t('analytics.cards.expense'), value: formatMoney(summary?.totalExpense || 0), Icon: TrendingDown, c: 'text-danger-400', bg: 'bg-danger-500/10' },
          { label: t('analytics.cards.net'), value: formatMoney((summary?.totalBalance ?? summary?.netBalance) || 0), Icon: ArrowUpDown, c: 'text-primary-400', bg: 'bg-primary-500/10' },
        ].map((item, index) => (
          <div key={index} className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-9 h-9 rounded-xl ${item.bg} flex items-center justify-center`}><item.Icon className={`w-5 h-5 ${item.c}`} /></div>
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
            <p className={`text-xl font-bold font-mono ${item.c}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-1 p-1 bg-gray-800/50 rounded-lg">
        {['daily', 'weekly', 'monthly', 'yearly'].map((item) => (
          <button
            key={item}
            onClick={() => setPeriod(item)}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${period === item ? 'bg-dark-700 text-primary-400 shadow-sm' : 'text-gray-500'}`}
          >
            {t(`report.periods.${item}`)}
          </button>
        ))}
      </div>

      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
        <h3 className="font-semibold text-white mb-4">{t('analytics.incomeExpense')}</h3>
        {byPeriod.length === 0 ? (
          <div className="h-60 flex items-center justify-center text-gray-600 text-sm">{t('analytics.noData')}</div>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={byPeriod}>
                <defs>
                  <linearGradient id="ai" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.25} /><stop offset="95%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ae" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.25} /><stop offset="95%" stopColor="#EF4444" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                <XAxis dataKey="period" tick={{ fontSize: 10, fill: chartAxis }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: chartAxis }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v)} />
                <Tooltip
                  cursor={false}
                  contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, background: tooltipBackground, color: tooltipText, fontSize: '12px' }}
                  itemStyle={{ color: tooltipText }}
                  labelStyle={{ color: tooltipLabel }}
                  formatter={(v, n) => [formatMoney(v), n === 'income' ? t('analytics.cards.income') : t('analytics.cards.expense')]}
                />
                <Area type="monotone" dataKey="income" stroke="#10B981" fill="url(#ai)" strokeWidth={2.5} dot={false} />
                <Area type="monotone" dataKey="expense" stroke="#EF4444" fill="url(#ae)" strokeWidth={2.5} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {pieData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
            <h3 className="font-semibold text-white mb-4">{t('analytics.expenseDistribution')}</h3>
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v) => formatMoney(v)}
                    contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, background: tooltipBackground, color: tooltipText, fontSize: '12px' }}
                    itemStyle={{ color: tooltipText }}
                    labelStyle={{ color: tooltipLabel }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              {pieData.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-gray-500 truncate">{c.icon} {c.name}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
            <h3 className="font-semibold text-white mb-4">{t('analytics.topCategories')}</h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={pieData} layout="vertical" margin={{ left: 10, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: chartAxis }} axisLine={false} tickLine={false} tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K` : v)} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: isLight ? '#334155' : '#6B7280' }} axisLine={false} tickLine={false} width={110} tickFormatter={(n) => {
                    const category = pieData.find((x) => x.name === n)
                    return `${category?.icon || ''} ${n}`
                  }} />
                  <Tooltip
                    formatter={(v) => [formatMoney(v), t('analytics.spent')]}
                    contentStyle={{ borderRadius: '12px', border: `1px solid ${tooltipBorder}`, background: tooltipBackground, color: tooltipText, fontSize: '12px' }}
                    itemStyle={{ color: tooltipText }}
                    labelStyle={{ color: tooltipLabel }}
                  />
                  <Bar dataKey="value" radius={[0, 6, 6, 0]}>{pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {pieData.length === 0 && (
        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-12 text-center">
          <p className="text-4xl mb-3">{'\u{1F4CA}'}</p>
          <p className="text-gray-500 text-sm">{t('analytics.emptyPrompt')}</p>
        </div>
      )}
    </div>
  )
}
