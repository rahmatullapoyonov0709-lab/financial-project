import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Plus, Users, X, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { useAppSettings } from '../context/AppSettingsContext'
import { translateCategoryName } from '../utils/categoryTranslations'

export default function Budget() {
  const { t, formatMoney } = useAppSettings()
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [budgets, setBudgets] = useState([])
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ categoryId: '', limitAmount: '' })
  const [household, setHousehold] = useState(null)

  const load = async () => {
    try {
      const [b, c, householdRes] = await Promise.all([
        api.get(`/budgets?month=${month}&year=${year}`),
        api.get('/categories?type=EXPENSE'),
        api.get('/household/me'),
      ])
      setBudgets(b.data.budgets)
      setCategories(c.data.categories)
      setHousehold(householdRes.data)
    } catch (error) {
      toast.error(error.message || t('budget.toasts.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [month, year])

  const prevMonth = () => {
    if (month === 1) {
      setMonth(12)
      setYear((y) => y - 1)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 12) {
      setMonth(1)
      setYear((y) => y + 1)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const usedIds = budgets.map((b) => b.category_id)
  const available = categories.filter((c) => !usedIds.includes(c.id))
  const familyActive = Number(household?.members?.length || 0) > 1

  const handleAdd = async (e) => {
    e.preventDefault()
    if (!form.categoryId || !form.limitAmount) {
      toast.error(t('budget.toasts.required'))
      return
    }

    setSaving(true)
    try {
      await api.post('/budgets', {
        categoryId: form.categoryId,
        month,
        year,
        limitAmount: Number.parseFloat(form.limitAmount),
      })
      toast.success(t('budget.toasts.added'))
      setModalOpen(false)
      setForm({ categoryId: '', limitAmount: '' })
      await load()
    } catch (error) {
      toast.error(error.message || t('budget.toasts.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/budgets/${id}`)
      toast.success(t('budget.toasts.deleted'))
      await load()
    } catch (error) {
      toast.error(error.message || t('budget.toasts.loadError'))
    }
  }

  if (loading) return <div className="p-6 flex justify-center"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-gray-700/50 transition-colors"><ChevronLeft className="w-5 h-5 text-gray-400" /></button>
          <h2 className="text-lg font-bold text-white">{t(`budget.months.${month}`)} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-gray-700/50 transition-colors"><ChevronRight className="w-5 h-5 text-gray-400" /></button>
        </div>
      </div>

      <div className="bg-dark-800 rounded-2xl border border-primary-500/20 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-500/12">
            <Users className="h-5 w-5 text-primary-300" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">
              {familyActive ? t('budget.family.activeTitle') : t('budget.family.personalTitle')}
            </h3>
            <p className="mt-1 text-xs text-gray-400">
              {familyActive
                ? t('budget.family.activeText', {
                    name: household?.household?.name || t('common.unknown'),
                    count: household?.members?.length || 0,
                  })
                : t('budget.family.personalText')}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {budgets.length === 0 && (
          <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-12 text-center">
            <p className="text-4xl mb-3">{'\u{1F3AF}'}</p>
            <p className="text-gray-500 text-sm">{t('budget.empty')}</p>
          </div>
        )}

        {budgets.map((b) => {
          const pct = Math.min(Number.parseFloat(b.usage_percent || 0), 100)
          const remaining = Number.parseFloat(b.remaining || 0)
          const color = pct >= 100 ? 'bg-danger-500' : pct >= 70 ? 'bg-warning-500' : 'bg-success-500'
          const textColor = pct >= 90 ? 'text-danger-400' : pct >= 70 ? 'text-warning-400' : 'text-success-400'
          const statusText = pct >= 100 ? t('budget.status.over') : pct >= 90 ? t('budget.status.danger') : pct >= 70 ? t('budget.status.warn') : t('budget.status.good')

          return (
            <div key={b.id} className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4 group">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center text-lg" style={{ backgroundColor: (b.category_color || '#6366F1') + '18' }}>{b.category_icon || '\u{1F4CA}'}</div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">{translateCategoryName(b.category_name, t)}</h4>
                    <span className={`text-[11px] font-medium ${textColor}`}>{statusText}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pct >= 90 ? 'bg-danger-500/10 text-danger-400' : pct >= 70 ? 'bg-warning-500/10 text-warning-400' : 'bg-success-500/10 text-success-400'}`}>{pct}%</span>
                  <button onClick={() => handleDelete(b.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger-500/10 text-gray-500 hover:text-danger-400 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${pct}%` }} />
              </div>

              <div className="flex justify-between mt-2.5 text-xs">
                <span className="text-gray-500"><span className="font-semibold text-gray-300">{formatMoney(b.spent_amount, { currency: 'UZS' })}</span> / {formatMoney(b.limit_amount || b.budget, { currency: 'UZS' })}</span>
                <span className={`font-medium ${remaining >= 0 ? 'text-success-400' : 'text-danger-400'}`}>
                  {remaining >= 0 ? t('budget.remaining', { amount: formatMoney(remaining, { currency: 'UZS' }) }) : t('budget.exceeded', { amount: formatMoney(Math.abs(remaining), { currency: 'UZS' }) })}
                </span>
              </div>
            </div>
          )
        })}

        <button onClick={() => setModalOpen(true)} className="w-full p-4 rounded-2xl border-2 border-dashed border-gray-700 text-gray-600 hover:text-primary-400 hover:border-primary-500/50 transition-all flex items-center justify-center gap-2 text-sm font-medium">
          <Plus className="w-4 h-4" /> {t('budget.addLimit')}
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white">{t('budget.addLimitTitle')}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-700/50"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleAdd} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('budget.fields.category')}</label>
                {available.length === 0 ? (
                  <p className="text-sm text-warning-400 bg-warning-500/10 p-3 rounded-xl">{t('budget.allCategoriesUsed')}</p>
                ) : (
                  <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                    <option value="">{t('common.select')}</option>
                    {available.map((c) => <option key={c.id} value={c.id}>{c.icon} {translateCategoryName(c.name, t)}</option>)}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('budget.fields.monthlyLimit')}</label>
                <FormattedNumberInput
                  placeholder={t('budget.fields.monthlyLimitPlaceholder')}
                  value={form.limitAmount}
                  onChange={(next) => setForm({ ...form, limitAmount: next })}
                  allowDecimal
                  maxDecimals={2}
                  className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving || available.length === 0} className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">{saving ? '...' : t('common.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
