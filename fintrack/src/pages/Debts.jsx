import { useState, useEffect } from 'react'
import { Plus, X, ArrowUpCircle, ArrowDownCircle, Calendar, CheckCircle2, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { useAppSettings } from '../context/AppSettingsContext'

const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB']

export default function Debts() {
  const { t, formatMoney } = useAppSettings()
  const [debts, setDebts] = useState([])
  const [summary, setSummary] = useState({ totalLent: 0, totalBorrowed: 0 })
  const [tab, setTab] = useState('LENT')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState({ personName: '', type: 'LENT', amount: '', currency: 'UZS', description: '', dueDate: '' })

  const load = async () => {
    try {
      const res = await api.get('/debts')
      setDebts(res.data.debts)
      setSummary(res.data.summary)
    } catch (error) {
      toast.error(error.message || t('debts.toasts.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = debts.filter((d) => d.type === tab)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.personName || !form.amount) {
      toast.error(t('debts.toasts.required'))
      return
    }

    setSaving(true)
    try {
      await api.post('/debts', {
        personName: form.personName,
        type: form.type,
        amount: Number.parseFloat(form.amount),
        currency: form.currency,
        description: form.description,
        dueDate: form.dueDate || undefined,
      })
      toast.success(form.type === 'LENT' ? t('debts.toasts.lentAdded') : t('debts.toasts.borrowedAdded'))
      setModalOpen(false)
      setForm({ personName: '', type: tab, amount: '', currency: 'UZS', description: '', dueDate: '' })
      await load()
    } catch (error) {
      toast.error(error.message || t('debts.toasts.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async (id) => {
    try {
      await api.put(`/debts/${id}`, { status: 'CLOSED' })
      toast.success(t('debts.toasts.closed'))
      await load()
    } catch (error) {
      toast.error(error.message || t('debts.toasts.loadError'))
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/debts/${id}`)
      toast.success(t('debts.toasts.deleted'))
      setDeleteConfirm(null)
      await load()
    } catch (error) {
      toast.error(error.message || t('debts.toasts.loadError'))
    }
  }

  if (loading) return <div className="p-6 flex justify-center"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4 border-l-4 border-l-orange-500">
          <div className="flex items-center gap-2 mb-2"><ArrowUpCircle className="w-5 h-5 text-orange-400" /><span className="text-xs text-gray-500">{t('debts.summary.lent')}</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatMoney(summary.totalLent)}</p>
        </div>
        <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4 border-l-4 border-l-blue-500">
          <div className="flex items-center gap-2 mb-2"><ArrowDownCircle className="w-5 h-5 text-blue-400" /><span className="text-xs text-gray-500">{t('debts.summary.borrowed')}</span></div>
          <p className="text-lg font-bold font-mono text-white">{formatMoney(summary.totalBorrowed)}</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 flex gap-1 p-1 bg-gray-800/50 rounded-xl">
          {[{ v: 'LENT', l: t('debts.tabs.lent'), I: ArrowUpCircle }, { v: 'BORROWED', l: t('debts.tabs.borrowed'), I: ArrowDownCircle }].map((item) => (
            <button key={item.v} onClick={() => setTab(item.v)} className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${tab === item.v ? 'bg-dark-700 shadow-sm ' + (item.v === 'LENT' ? 'text-orange-400' : 'text-blue-400') : 'text-gray-500'}`}>
              <item.I className="w-4 h-4" />{item.l}
            </button>
          ))}
        </div>

        <button onClick={() => { setForm({ ...form, type: tab }); setModalOpen(true) }} className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-500/25">
          <Plus className="w-4 h-4" /> {t('debts.add')}
        </button>
      </div>

      <div className="space-y-3">
        {filtered.length === 0 && (
          <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-12 text-center">
            <p className="text-4xl mb-3">{tab === 'LENT' ? '\u{1F91D}' : '\u{1F4B0}'}</p>
            <p className="text-gray-500 text-sm">{tab === 'LENT' ? t('debts.empty.lent') : t('debts.empty.borrowed')}</p>
          </div>
        )}

        {filtered.map((d) => (
          <div key={d.id} className={`bg-dark-800 rounded-2xl border border-gray-700/50 p-4 border-l-4 ${d.status === 'OPEN' ? (tab === 'LENT' ? 'border-l-orange-500' : 'border-l-blue-500') : 'border-l-success-500 opacity-60'} group`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0 ${d.status === 'OPEN' ? (tab === 'LENT' ? 'bg-orange-500/10 text-orange-400' : 'bg-blue-500/10 text-blue-400') : 'bg-success-500/10 text-success-400'}`}>
                  {d.person_name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-white">{d.person_name}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${d.status === 'OPEN' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-success-500/10 text-success-400'}`}>
                      {d.status === 'OPEN' ? t('debts.status.open') : t('debts.status.closed')}
                    </span>
                  </div>
                  {d.description && <p className="text-xs text-gray-500 mt-0.5">{d.description}</p>}
                  {d.due_date && <span className="flex items-center gap-1 text-xs text-gray-500 mt-1"><Calendar className="w-3 h-3" />{d.due_date?.split('T')[0]}</span>}
                </div>
              </div>

              <div className="text-right flex flex-col items-end gap-1.5">
                <p className="text-lg font-bold font-mono text-white">{formatMoney(d.amount, { currency: d.currency })}</p>
                <div className="flex gap-1">
                  {d.status === 'OPEN' && (
                    <button onClick={() => handleClose(d.id)} className="flex items-center gap-1 px-2 py-1 bg-success-500 text-white rounded-lg text-xs font-medium hover:bg-success-600 transition-colors">
                      <CheckCircle2 className="w-3 h-3" /> {t('debts.close')}
                    </button>
                  )}
                  <button onClick={() => setDeleteConfirm(d)} className="p-1.5 rounded-lg hover:bg-danger-500/10 text-gray-500 hover:text-danger-400 transition-colors opacity-0 group-hover:opacity-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white">{t('debts.newDebt')}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-700/50"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm({ ...form, type: 'LENT' })} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.type === 'LENT' ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-gray-700 text-gray-500'}`}>
                  <ArrowUpCircle className="w-4 h-4" /> {t('debts.tabs.lent')}
                </button>
                <button type="button" onClick={() => setForm({ ...form, type: 'BORROWED' })} className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${form.type === 'BORROWED' ? 'border-blue-500 bg-blue-500/10 text-blue-400' : 'border-gray-700 text-gray-500'}`}>
                  <ArrowDownCircle className="w-4 h-4" /> {t('debts.tabs.borrowed')}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('debts.fields.personName')}</label>
                <input type="text" placeholder={t('debts.fields.personPlaceholder')} value={form.personName} onChange={(e) => setForm({ ...form, personName: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('debts.fields.amount')}</label>
                  <FormattedNumberInput
                    placeholder="0"
                    value={form.amount}
                    onChange={(next) => setForm({ ...form, amount: next })}
                    allowDecimal
                    maxDecimals={2}
                    className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('debts.fields.currency')}</label>
                  <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('debts.fields.dueDate')}</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('debts.fields.description')}</label>
                <input type="text" placeholder={t('debts.fields.descriptionPlaceholder')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">{saving ? '...' : t('common.create')}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 border border-gray-700/50">
            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-danger-500/10 flex items-center justify-center mx-auto mb-3"><Trash2 className="w-7 h-7 text-danger-400" /></div>
              <h3 className="text-lg font-semibold text-white mb-1">{t('debts.delete.title')}</h3>
              <p className="text-sm text-gray-400">{t('debts.delete.text', { name: deleteConfirm.person_name })}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium transition-colors">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
