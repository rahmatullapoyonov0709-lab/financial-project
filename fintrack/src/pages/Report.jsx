import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus, ReceiptText, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { BarChart, Bar, CartesianGrid, Tooltip, XAxis, YAxis, Cell } from 'recharts'
import toast from 'react-hot-toast'
import { api } from '../api'
import { useAppSettings } from '../context/AppSettingsContext'
import { translateCategoryName } from '../utils/categoryTranslations'

const TX_CHANGED_EVENT = 'fintrack:transactions-changed'
const TX_CHANGED_KEY = 'fintrack:transactions:last-change'

const PERIODS = ['daily', 'weekly', 'monthly', 'yearly']
const EXPENSE_SHADES = ['#F87171', '#EF4444', '#DC2626', '#F43F5E', '#FB7185', '#E11D48', '#BE123C', '#FB923C']
const INCOME_SHADES = ['#4ADE80', '#22C55E', '#16A34A', '#10B981', '#34D399', '#059669', '#047857', '#65A30D']
const FALLBACK_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#F97316', '#84CC16', '#EC4899', '#14B8A6']

const toYmd = (date) => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const cloneDate = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const addDays = (date, days) => {
  const next = cloneDate(date)
  next.setDate(next.getDate() + days)
  return next
}

const addMonths = (date, months) => new Date(date.getFullYear(), date.getMonth() + months, 1)

const parseDateRef = (ref) => {
  if (typeof ref !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(ref)) return null
  const [y, m, d] = ref.split('-').map((x) => Number.parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null
  const date = new Date(y, m - 1, d)
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null
  return date
}

const parseMonthRef = (ref) => {
  if (typeof ref !== 'string' || !/^\d{4}-\d{2}$/.test(ref)) return null
  const [y, m] = ref.split('-').map((x) => Number.parseInt(x, 10))
  if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null
  return { year: y, month: m }
}

const parseYearRef = (ref) => {
  const year = Number.parseInt(String(ref || '').replace(/[^\d]/g, ''), 10)
  if (!Number.isFinite(year) || year < 1900 || year > 2200) return null
  return year
}

const getWeekRange = (date) => {
  const dayIndex = (date.getDay() + 6) % 7
  const from = addDays(date, -dayIndex)
  const to = addDays(from, 6)
  return { from, to }
}

const getRangeFromRef = (period, ref, fallbackNow = new Date()) => {
  if (period === 'daily') {
    const date = parseDateRef(ref) || cloneDate(fallbackNow)
    return { from: toYmd(date), to: toYmd(date), label: toYmd(date) }
  }

  if (period === 'weekly') {
    const date = parseDateRef(ref) || cloneDate(fallbackNow)
    const week = getWeekRange(date)
    return {
      from: toYmd(week.from),
      to: toYmd(week.to),
      label: `${toYmd(week.from)} - ${toYmd(week.to)}`,
    }
  }

  if (period === 'monthly') {
    const parsed = parseMonthRef(ref)
    const year = parsed ? parsed.year : fallbackNow.getFullYear()
    const month = parsed ? parsed.month : fallbackNow.getMonth() + 1
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0)
    return {
      from: toYmd(from),
      to: toYmd(to),
      label: `${year}-${String(month).padStart(2, '0')}`,
    }
  }

  const year = parseYearRef(ref) || fallbackNow.getFullYear()
  return { from: `${year}-01-01`, to: `${year}-12-31`, label: String(year) }
}

const getDefaultRefs = (period, now = new Date()) => {
  const today = cloneDate(now)

  if (period === 'daily') {
    return { current: toYmd(today), previous: toYmd(addDays(today, -1)) }
  }

  if (period === 'weekly') {
    return { current: toYmd(today), previous: toYmd(addDays(today, -7)) }
  }

  if (period === 'monthly') {
    const prevMonth = addMonths(today, -1)
    return {
      current: `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`,
      previous: `${prevMonth.getFullYear()}-${String(prevMonth.getMonth() + 1).padStart(2, '0')}`,
    }
  }

  return { current: String(today.getFullYear()), previous: String(today.getFullYear() - 1) }
}

const derivePreviousRef = (period, currentRef, now = new Date()) => {
  if (period === 'daily') {
    const currentDate = parseDateRef(currentRef) || cloneDate(now)
    return toYmd(addDays(currentDate, -1))
  }

  if (period === 'weekly') {
    const currentDate = parseDateRef(currentRef) || cloneDate(now)
    return toYmd(addDays(currentDate, -7))
  }

  if (period === 'monthly') {
    const parsed = parseMonthRef(currentRef)
    const base = parsed ? new Date(parsed.year, parsed.month - 1, 1) : new Date(now.getFullYear(), now.getMonth(), 1)
    const prev = addMonths(base, -1)
    return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
  }

  const year = parseYearRef(currentRef) || now.getFullYear()
  return String(year - 1)
}

const sanitizeRefByPeriod = (period, raw) => {
  const value = String(raw ?? '').trim()
  if (period === 'yearly') return value.replace(/[^\d]/g, '').slice(0, 4)
  if (period === 'monthly') return value.slice(0, 7)
  return value.slice(0, 10)
}

const withRange = (path, range, nonce) => {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}from=${range.from}&to=${range.to}&_=${nonce}`
}

const toAmount = (value) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const compactMoney = (value) => {
  const n = Number(value || 0)
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(Math.round(n))
}

const isHexColor = (value) => /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(value || '')

const normalizeCategories = (rows = [], unknownLabel = 'Unknown', translateName = (value) => value) => rows
  .map((row, index) => ({
    key: row.category_id || row.name || `cat-${index}`,
    name: row.name ? translateName(row.name) : unknownLabel,
    icon: row.icon || '',
    color: isHexColor(row.color) ? row.color : FALLBACK_COLORS[index % FALLBACK_COLORS.length],
    total: toAmount(row.total),
  }))
  .filter((row) => row.total > 0)
  .sort((a, b) => b.total - a.total)

const calcChange = (current, previous) => {
  const delta = current - previous
  if (previous === 0) return { delta, percent: current === 0 ? 0 : null }
  return { delta, percent: (delta / Math.abs(previous)) * 100 }
}

const getCategoryMap = (rows) => {
  const map = new Map()
  rows.forEach((row) => map.set(row.key, row))
  return map
}

const getTrendTone = (kind, delta) => {
  if (delta === 0) return 'text-gray-400'
  if (kind === 'expense') return delta > 0 ? 'text-danger-400' : 'text-success-400'
  return delta > 0 ? 'text-success-400' : 'text-danger-400'
}

function ChangeIndicator({ change, kind, t }) {
  const tone = getTrendTone(kind, change.delta)

  if (change.delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400 font-medium">
        <Minus className="w-3 h-3" /> 0%
      </span>
    )
  }

  const Icon = change.delta > 0 ? ArrowUpRight : ArrowDownRight
  const percentLabel = change.percent === null ? t('report.change.new') : `${Math.abs(change.percent).toFixed(1)}%`

  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold ${tone}`}>
      <Icon className="w-3.5 h-3.5" />
      {percentLabel} ({change.delta > 0 ? '+' : '-'}{compactMoney(Math.abs(change.delta))})
    </span>
  )
}

function MetricCard({ title, value, change, kind, icon: Icon, subtitle, t }) {
  return (
    <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kind === 'expense' ? 'bg-danger-500/10' : kind === 'income' ? 'bg-success-500/10' : 'bg-primary-500/10'}`}>
          <Icon className={`w-4 h-4 ${kind === 'expense' ? 'text-danger-400' : kind === 'income' ? 'text-success-400' : 'text-primary-400'}`} />
        </div>
        <span className="text-xs text-gray-400">{title}</span>
      </div>
      <p className="text-base font-bold text-white font-mono truncate">{value}</p>
      {subtitle && <p className="text-xs text-gray-500 mt-1 truncate">{subtitle}</p>}
      <div className="mt-2">
        <ChangeIndicator change={change} kind={kind} t={t} />
      </div>
    </div>
  )
}

function EmptyStateCard({ text }) {
  return (
    <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-8 text-center text-sm text-gray-500">
      {text}
    </div>
  )
}

function PeriodRefInput({ period, value, onChange, onCommit, id }) {
  if (period === 'monthly') {
    return (
      <input
        id={id}
        type="month"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      />
    )
  }

  if (period === 'yearly') {
    return (
      <input
        id={id}
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            onCommit?.()
          }
        }}
        placeholder="2026"
        className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
      />
    )
  }

  return (
    <input
      id={id}
      type="date"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-gray-700 bg-dark-900 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
    />
  )
}

function SinglePeriodCategoryChart({ title, rows, emptyText, mode, theme, formatMoney }) {
  if (!rows.length) return <EmptyStateCard text={emptyText} />

  const chartData = rows.slice(0, 10).map((row) => ({
    key: row.key,
    category: row.name,
    value: row.total,
  }))

  const chartWidth = Math.max(240, chartData.length * 92)
  const palette = mode === 'expense' ? EXPENSE_SHADES : INCOME_SHADES
  const isLight = theme === 'light'

  return (
    <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4">
      <h3 className="text-sm font-semibold text-white mb-2">{title}</h3>
      <div className="overflow-x-auto">
        <div style={{ width: chartWidth }}>
          <BarChart width={chartWidth} height={248} data={chartData} barSize={26} style={{ background: 'transparent' }}>
            <CartesianGrid strokeDasharray="3 3" stroke={isLight ? '#CBD5E1' : '#1E293B'} />
            <XAxis
              dataKey="category"
              interval={0}
              angle={-24}
              textAnchor="end"
              height={72}
              tick={{ fontSize: 11, fill: isLight ? '#334155' : '#64748B' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis tick={{ fontSize: 10, fill: isLight ? '#334155' : '#64748B' }} axisLine={false} tickLine={false} tickFormatter={compactMoney} />
            <Tooltip
              cursor={false}
              formatter={(value) => formatMoney(value)}
              contentStyle={{
                borderRadius: '12px',
                border: `1px solid ${isLight ? '#CBD5E1' : '#334155'}`,
                background: isLight ? '#F8FAFC' : '#0F172A',
                color: isLight ? '#0F172A' : '#E2E8F0',
                fontSize: '12px',
              }}
              itemStyle={{ color: isLight ? '#0F172A' : '#E2E8F0' }}
              labelStyle={{ color: isLight ? '#334155' : '#94A3B8' }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} activeBar={false}>
              {chartData.map((entry, index) => (
                <Cell key={entry.key} fill={palette[index % palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </div>
      </div>
    </div>
  )
}

const describeChange = (name, change, t, formatMoney) => {
  if (change.delta === 0) {
    return t('report.change.equal', { name })
  }

  if (change.percent === null) {
    return t('report.change.appeared', { name })
  }

  if (change.delta > 0) {
    return t('report.change.increased', {
      name,
      percent: Math.abs(change.percent).toFixed(1),
      delta: formatMoney(change.delta),
    })
  }

  return t('report.change.decreased', {
    name,
    percent: Math.abs(change.percent).toFixed(1),
    delta: formatMoney(Math.abs(change.delta)),
  })
}

export default function Report() {
  const { t, formatMoney, theme, currency } = useAppSettings()
  const mapCategoryName = useCallback((name) => translateCategoryName(name, t), [t])
  const [period, setPeriod] = useState('daily')
  const initialRefs = getDefaultRefs('daily', new Date())
  const [currentRef, setCurrentRef] = useState(initialRefs.current)
  const [previousRef, setPreviousRef] = useState(initialRefs.previous)
  const [currentInput, setCurrentInput] = useState(initialRefs.current)
  const [previousInput, setPreviousInput] = useState(initialRefs.previous)
  const [currentTouched, setCurrentTouched] = useState(false)
  const [previousTouched, setPreviousTouched] = useState(false)
  const [loading, setLoading] = useState(true)
  const requestRef = useRef(0)
  const [report, setReport] = useState({
    currentSummary: { totalIncome: 0, totalExpense: 0, netBalance: 0 },
    previousSummary: { totalIncome: 0, totalExpense: 0, netBalance: 0 },
    expenseCurrent: [],
    expensePrevious: [],
    incomeCurrent: [],
    incomePrevious: [],
  })

  useEffect(() => {
    const defaults = getDefaultRefs(period, new Date())
    setCurrentRef(defaults.current)
    setPreviousRef(defaults.previous)
    setCurrentInput(defaults.current)
    setPreviousInput(defaults.previous)
    setCurrentTouched(false)
    setPreviousTouched(false)
  }, [period])

  const currentRange = useMemo(() => getRangeFromRef(period, currentRef, new Date()), [period, currentRef])
  const previousRange = useMemo(() => getRangeFromRef(period, previousRef, new Date()), [period, previousRef])

  const loadReport = useCallback(async ({ showLoader = true } = {}) => {
    if (showLoader) setLoading(true)
    const requestId = ++requestRef.current
    const nonce = Date.now()

    try {
      const base = new URLSearchParams({ baseCurrency: currency }).toString()
      const [summaryCurrentRes, summaryPreviousRes, expenseCurrentRes, expensePreviousRes, incomeCurrentRes, incomePreviousRes] = await Promise.all([
        api.get(withRange(`/analytics/summary?${base}`, currentRange, nonce)),
        api.get(withRange(`/analytics/summary?${base}`, previousRange, nonce)),
        api.get(withRange(`/analytics/by-category?type=EXPENSE&${base}`, currentRange, nonce)),
        api.get(withRange(`/analytics/by-category?type=EXPENSE&${base}`, previousRange, nonce)),
        api.get(withRange(`/analytics/by-category?type=INCOME&${base}`, currentRange, nonce)),
        api.get(withRange(`/analytics/by-category?type=INCOME&${base}`, previousRange, nonce)),
      ])

      if (requestId !== requestRef.current) return

      setReport({
        currentSummary: summaryCurrentRes.data || { totalIncome: 0, totalExpense: 0, netBalance: 0 },
        previousSummary: summaryPreviousRes.data || { totalIncome: 0, totalExpense: 0, netBalance: 0 },
        expenseCurrent: normalizeCategories(expenseCurrentRes.data || [], t('common.unknown'), mapCategoryName),
        expensePrevious: normalizeCategories(expensePreviousRes.data || [], t('common.unknown'), mapCategoryName),
        incomeCurrent: normalizeCategories(incomeCurrentRes.data || [], t('common.unknown'), mapCategoryName),
        incomePrevious: normalizeCategories(incomePreviousRes.data || [], t('common.unknown'), mapCategoryName),
      })
    } catch (error) {
      if (requestId === requestRef.current) {
        toast.error(error.message || t('report.errors.load'))
      }
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false)
      }
    }
  }, [currentRange, previousRange, t, mapCategoryName])

  useEffect(() => {
    loadReport({ showLoader: true })
  }, [loadReport])

  useEffect(() => {
    const syncAutoRefs = () => {
      if (!currentTouched) {
        const defaults = getDefaultRefs(period, new Date())
        setCurrentRef((prev) => (prev === defaults.current ? prev : defaults.current))
        setCurrentInput((prev) => (prev === defaults.current ? prev : defaults.current))
      }

      if (!previousTouched) {
        const defaults = getDefaultRefs(period, new Date())
        const derived = currentTouched ? derivePreviousRef(period, currentRef, new Date()) : defaults.previous
        setPreviousRef((prev) => (prev === derived ? prev : derived))
        setPreviousInput((prev) => (prev === derived ? prev : derived))
      }
    }

    syncAutoRefs()

    const onFocus = () => syncAutoRefs()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') syncAutoRefs()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') syncAutoRefs()
    }, 60000)

    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
      clearInterval(timer)
    }
  }, [period, currentTouched, previousTouched, currentRef])

  useEffect(() => {
    const refresh = () => loadReport({ showLoader: false })

    const onVisibility = () => {
      if (document.visibilityState === 'visible') refresh()
    }

    const onStorage = (event) => {
      if (event.key === TX_CHANGED_KEY) refresh()
    }

    window.addEventListener(TX_CHANGED_EVENT, refresh)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('storage', onStorage)

    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30000)

    return () => {
      window.removeEventListener(TX_CHANGED_EVENT, refresh)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('storage', onStorage)
      clearInterval(timer)
    }
  }, [loadReport])

  const commitCurrentRef = useCallback((next) => {
    const sanitized = sanitizeRefByPeriod(period, next)
    setCurrentRef(sanitized)

    if (!previousTouched) {
      const derived = derivePreviousRef(period, sanitized, new Date())
      setPreviousRef(derived)
      setPreviousInput(derived)
    }
  }, [period, previousTouched])

  const commitPreviousRef = useCallback((next) => {
    const sanitized = sanitizeRefByPeriod(period, next)
    setPreviousRef(sanitized)
  }, [period])

  const handleCurrentRefChange = (nextRaw) => {
    const next = sanitizeRefByPeriod(period, nextRaw)
    setCurrentTouched(true)
    setCurrentInput(next)

    if (period !== 'yearly') {
      commitCurrentRef(next)
    }
  }

  const handlePreviousRefChange = (nextRaw) => {
    const next = sanitizeRefByPeriod(period, nextRaw)
    setPreviousTouched(true)
    setPreviousInput(next)

    if (period !== 'yearly') {
      commitPreviousRef(next)
    }
  }

  const currentIncome = toAmount(report.currentSummary.totalIncome)
  const currentExpense = toAmount(report.currentSummary.totalExpense)
  const currentNet = toAmount(report.currentSummary.totalBalance ?? report.currentSummary.netBalance)
  const previousIncome = toAmount(report.previousSummary.totalIncome)
  const previousExpense = toAmount(report.previousSummary.totalExpense)
  const previousNet = toAmount(report.previousSummary.totalBalance ?? report.previousSummary.netBalance)

  const incomeChange = calcChange(currentIncome, previousIncome)
  const expenseChange = calcChange(currentExpense, previousExpense)
  const netChange = calcChange(currentNet, previousNet)

  const topExpense = report.expenseCurrent[0] || null
  const topIncome = report.incomeCurrent[0] || null

  const expensePreviousMap = useMemo(() => getCategoryMap(report.expensePrevious), [report.expensePrevious])
  const incomePreviousMap = useMemo(() => getCategoryMap(report.incomePrevious), [report.incomePrevious])

  const topExpensePreviousAmount = topExpense ? toAmount(expensePreviousMap.get(topExpense.key)?.total) : 0
  const topIncomePreviousAmount = topIncome ? toAmount(incomePreviousMap.get(topIncome.key)?.total) : 0
  const topExpenseChange = calcChange(topExpense ? topExpense.total : 0, topExpensePreviousAmount)
  const topIncomeChange = calcChange(topIncome ? topIncome.total : 0, topIncomePreviousAmount)

  const { mostIncreasedExpense, mostDecreasedIncome } = useMemo(() => {
    let increased = null
    let decreasedIncome = null

    const expenseKeys = new Set([
      ...report.expenseCurrent.map((item) => item.key),
      ...report.expensePrevious.map((item) => item.key),
    ])

    expenseKeys.forEach((key) => {
      const current = toAmount(report.expenseCurrent.find((item) => item.key === key)?.total)
      const previous = toAmount(report.expensePrevious.find((item) => item.key === key)?.total)
      const delta = current - previous
      if (delta > 0 && (!increased || delta > increased.delta)) {
        const name = report.expenseCurrent.find((item) => item.key === key)?.name
          || report.expensePrevious.find((item) => item.key === key)?.name
          || t('common.unknown')
        increased = { name, delta }
      }
    })

    const incomeKeys = new Set([
      ...report.incomeCurrent.map((item) => item.key),
      ...report.incomePrevious.map((item) => item.key),
    ])

    incomeKeys.forEach((key) => {
      const current = toAmount(report.incomeCurrent.find((item) => item.key === key)?.total)
      const previous = toAmount(report.incomePrevious.find((item) => item.key === key)?.total)
      const delta = current - previous
      if (delta < 0 && (!decreasedIncome || delta < decreasedIncome.delta)) {
        const name = report.incomeCurrent.find((item) => item.key === key)?.name
          || report.incomePrevious.find((item) => item.key === key)?.name
          || t('common.unknown')
        decreasedIncome = { name, delta }
      }
    })

    return { mostIncreasedExpense: increased, mostDecreasedIncome: decreasedIncome }
  }, [report.expenseCurrent, report.expensePrevious, report.incomeCurrent, report.incomePrevious, t])

  const summaryLines = useMemo(() => {
    if (currentIncome === 0 && currentExpense === 0) {
      return [t('report.empty.period')]
    }

    return [
      topExpense
        ? t('report.summary.topExpense', { name: topExpense.name, amount: formatMoney(topExpense.total) })
        : t('report.summary.topExpenseMissing'),
      topIncome
        ? t('report.summary.topIncome', { name: topIncome.name, amount: formatMoney(topIncome.total) })
        : t('report.summary.topIncomeMissing'),
      mostIncreasedExpense
        ? t('report.summary.increasedExpenseCategory', { name: mostIncreasedExpense.name, amount: formatMoney(mostIncreasedExpense.delta) })
        : t('report.summary.increasedExpenseCategoryMissing'),
      mostDecreasedIncome
        ? t('report.summary.decreasedIncomeSource', { name: mostDecreasedIncome.name, amount: formatMoney(Math.abs(mostDecreasedIncome.delta)) })
        : t('report.summary.decreasedIncomeSourceMissing'),
      describeChange(t('report.cards.totalExpense'), expenseChange, t, formatMoney),
      describeChange(t('report.cards.totalIncome'), incomeChange, t, formatMoney),
    ].slice(0, 6)
  }, [currentIncome, currentExpense, topExpense, topIncome, mostIncreasedExpense, mostDecreasedIncome, expenseChange, incomeChange, t, formatMoney])

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((item) => (
            <button
              key={item}
              onClick={() => setPeriod(item)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                period === item
                  ? 'bg-primary-500/15 text-primary-400 border border-primary-500/40'
                  : 'bg-dark-900 text-gray-400 border border-gray-700/70 hover:border-gray-600 hover:text-gray-200'
              }`}
            >
              {t(`report.periods.${item}`)}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-xl border border-gray-700/60 bg-dark-900 p-3">
            <label htmlFor="prev-period-ref" className="block text-xs text-gray-400 mb-2">{t('report.previousPeriod')}</label>
            <PeriodRefInput
              period={period}
              value={previousInput}
              onChange={handlePreviousRefChange}
              onCommit={() => commitPreviousRef(previousInput)}
              id="prev-period-ref"
            />
            <p className="text-[11px] text-gray-500 mt-2">{previousRange.label}</p>
          </div>

          <div className="rounded-xl border border-gray-700/60 bg-dark-900 p-3">
            <label htmlFor="curr-period-ref" className="block text-xs text-gray-400 mb-2">{t('report.currentPeriod')}</label>
            <PeriodRefInput
              period={period}
              value={currentInput}
              onChange={handleCurrentRefChange}
              onCommit={() => commitCurrentRef(currentInput)}
              id="curr-period-ref"
            />
            <p className="text-[11px] text-gray-500 mt-2">{currentRange.label}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
        <MetricCard title={t('report.cards.totalIncome')} value={formatMoney(currentIncome)} change={incomeChange} kind="income" icon={TrendingUp} t={t} />
        <MetricCard title={t('report.cards.totalExpense')} value={formatMoney(currentExpense)} change={expenseChange} kind="expense" icon={TrendingDown} t={t} />
        <MetricCard title={t('report.cards.netResult')} value={formatMoney(currentNet)} change={netChange} kind="net" icon={Wallet} t={t} />
        <MetricCard
          title={t('report.cards.topExpense')}
          value={topExpense ? `${topExpense.icon} ${topExpense.name}` : t('report.cards.noInfo')}
          subtitle={topExpense ? formatMoney(topExpense.total) : formatMoney(0)}
          change={topExpenseChange}
          kind="expense"
          icon={ReceiptText}
          t={t}
        />
        <MetricCard
          title={t('report.cards.topIncome')}
          value={topIncome ? `${topIncome.icon} ${topIncome.name}` : t('report.cards.noInfo')}
          subtitle={topIncome ? formatMoney(topIncome.total) : formatMoney(0)}
          change={topIncomeChange}
          kind="income"
          icon={ReceiptText}
          t={t}
        />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">{t('report.sections.expenses')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SinglePeriodCategoryChart
            title={t('report.sections.previousExpenses')}
            rows={report.expensePrevious}
            emptyText={t('report.empty.previousExpense')}
            mode="expense"
            theme={theme}
            formatMoney={formatMoney}
          />
          <SinglePeriodCategoryChart
            title={t('report.sections.currentExpenses')}
            rows={report.expenseCurrent}
            emptyText={t('report.empty.currentExpense')}
            mode="expense"
            theme={theme}
            formatMoney={formatMoney}
          />
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-white">{t('report.sections.incomes')}</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <SinglePeriodCategoryChart
            title={t('report.sections.previousIncomes')}
            rows={report.incomePrevious}
            emptyText={t('report.empty.previousIncome')}
            mode="income"
            theme={theme}
            formatMoney={formatMoney}
          />
          <SinglePeriodCategoryChart
            title={t('report.sections.currentIncomes')}
            rows={report.incomeCurrent}
            emptyText={t('report.empty.currentIncome')}
            mode="income"
            theme={theme}
            formatMoney={formatMoney}
          />
        </div>
      </section>

      <section className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
        <h2 className="text-lg font-bold text-white mb-3">{t('report.sections.shortSummary')}</h2>
        <div className="space-y-2">
          {summaryLines.map((line, index) => (
            <p key={index} className="text-sm text-gray-300 leading-relaxed">
              {index + 1}. {line}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}
