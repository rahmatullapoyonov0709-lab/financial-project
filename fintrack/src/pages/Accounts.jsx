import { useState, useEffect } from 'react'
import { Plus, X, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { useAppSettings } from '../context/AppSettingsContext'

const TYPE_CONFIG = {
  CASH: { icon: '\u{1F4B5}', key: 'CASH', gradient: 'from-emerald-400 to-teal-500' },
  BANK_CARD: { icon: '\u{1F4B3}', key: 'BANK_CARD', gradient: 'from-blue-400 to-indigo-500' },
  SAVINGS: { icon: '\u{1F3E6}', key: 'SAVINGS', gradient: 'from-purple-400 to-pink-500' },
}
const CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB']

export default function Accounts() {
  const { t, formatMoney, formatNumber } = useAppSettings()
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState({ name: '', type: 'CASH', currency: 'UZS', balance: '' })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const res = await api.get('/accounts')
      setAccounts(res.data.accounts)
    } catch (error) {
      toast.error(error.message || t('accounts.toasts.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditingId(null)
    setForm({ name: '', type: 'CASH', currency: 'UZS', balance: '' })
    setModalOpen(true)
  }

  const openEdit = (account) => {
    setEditingId(account.id)
    setForm({ name: account.name, type: account.type, currency: account.currency, balance: account.balance })
    setModalOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name) {
      toast.error(t('accounts.toasts.nameRequired'))
      return
    }

    setSaving(true)
    try {
      if (editingId) {
        await api.put(`/accounts/${editingId}`, { name: form.name, type: form.type, currency: form.currency })
        toast.success(t('accounts.toasts.updated'))
      } else {
        await api.post('/accounts', {
          name: form.name,
          type: form.type,
          currency: form.currency,
          balance: Number.parseFloat(form.balance) || 0,
        })
        toast.success(t('accounts.toasts.created'))
      }

      await load()
      setModalOpen(false)
    } catch (error) {
      toast.error(error.message || t('accounts.toasts.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/accounts/${id}`)
      toast.success(t('accounts.toasts.deleted'))
      setDeleteConfirm(null)
      await load()
    } catch (error) {
      toast.error(error.message || t('accounts.toasts.loadError'))
    }
  }

  const totalUZS = accounts
    .filter((account) => account.currency === 'UZS')
    .reduce((sum, account) => sum + Number.parseFloat(account.balance), 0)

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="bg-gradient-to-br from-primary-500 to-purple-600 rounded-2xl p-5 text-white">
        <p className="text-sm text-white/70 mb-1">{t('accounts.summaryTitle')}</p>
        <p className="text-3xl font-bold font-mono">{formatMoney(totalUZS, { currency: 'UZS' })}</p>
        <p className="text-sm text-white/70 mt-2">{t('accounts.count', { count: formatNumber(accounts.length) })}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {accounts.map((account) => {
          const cfg = TYPE_CONFIG[account.type] || TYPE_CONFIG.CASH
          return (
            <div key={account.id} className="bg-dark-800 rounded-2xl border border-gray-700/50 overflow-hidden hover:border-gray-600/50 transition-all group">
              <div className={`h-1.5 bg-gradient-to-r ${cfg.gradient}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-primary-500/10 flex items-center justify-center text-2xl">{cfg.icon}</div>
                    <div>
                      <h3 className="font-semibold text-white">{account.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 bg-gray-700 text-gray-400 rounded-full">{t(`accounts.types.${cfg.key}`)} · {account.currency}</span>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(account)} className="p-1.5 rounded-lg hover:bg-primary-500/10 text-gray-500 hover:text-primary-400 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setDeleteConfirm(account)} className="p-1.5 rounded-lg hover:bg-danger-500/10 text-gray-500 hover:text-danger-400 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mb-1">{t('accounts.balance')}</p>
                <p className="text-2xl font-bold font-mono text-white">{formatMoney(account.balance, { currency: account.currency })}</p>
              </div>
            </div>
          )
        })}

        <button onClick={openCreate} className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed border-gray-700 text-gray-600 hover:text-primary-400 hover:border-primary-500/50 transition-all min-h-[180px]">
          <Plus className="w-8 h-8 mb-2" /><span className="text-sm font-medium">{t('accounts.newAccount')}</span>
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white">{editingId ? t('accounts.editAccount') : t('accounts.createAccount')}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-700/50 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('accounts.fields.name')}</label>
                <input
                  type="text"
                  placeholder={t('accounts.fields.namePlaceholder')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('accounts.fields.type')}</label>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(TYPE_CONFIG).map(([key, val]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setForm({ ...form, type: key })}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${form.type === key ? 'border-primary-500 bg-primary-500/10' : 'border-gray-700 hover:border-gray-600'}`}
                    >
                      <span className="text-2xl">{val.icon}</span>
                      <span className="text-xs text-gray-400">{t(`accounts.types.${val.key}`)}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">{t('accounts.fields.currency')}</label>
                <div className="grid grid-cols-4 gap-2">
                  {CURRENCIES.map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => setForm({ ...form, currency: cur })}
                      className={`py-2 rounded-xl border-2 text-sm font-bold transition-all ${form.currency === cur ? 'border-primary-500 bg-primary-500/10 text-primary-400' : 'border-gray-700 text-gray-500 hover:border-gray-600'}`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              {!editingId && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('accounts.fields.initialBalance')}</label>
                  <FormattedNumberInput
                    placeholder="0"
                    value={form.balance}
                    onChange={(next) => setForm({ ...form, balance: next })}
                    allowDecimal
                    maxDecimals={2}
                    className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">
                  {saving ? '...' : editingId ? t('common.save') : t('common.create')}
                </button>
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
              <h3 className="text-lg font-semibold text-white mb-1">{t('accounts.delete.title')}</h3>
              <p className="text-sm text-gray-400">{t('accounts.delete.text', { name: deleteConfirm.name })}</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
              <button onClick={() => handleDelete(deleteConfirm.id)} className="flex-1 py-2.5 rounded-xl bg-danger-500 hover:bg-danger-600 text-white text-sm font-medium transition-colors">{t('common.delete')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
