import { useEffect, useState } from 'react'
import { Plus, X, ArrowLeftRight, ArrowRight, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { useAppSettings } from '../context/AppSettingsContext'

const getToday = () => new Date().toISOString().split('T')[0]

export default function Transfers() {
  const { t, formatMoney, formatNumber } = useAppSettings()
  const [transfers, setTransfers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [form, setForm] = useState({
    fromAccountId: '',
    toAccountId: '',
    fromAmount: '',
    date: getToday(),
    note: '',
  })
  const [quote, setQuote] = useState({ loading: false, error: '', data: null })

  const setDefaultAccounts = (accountList) => {
    if (accountList.length < 2) return
    setForm((prev) => {
      if (prev.fromAccountId && prev.toAccountId) return prev
      return {
        ...prev,
        fromAccountId: prev.fromAccountId || accountList[0].id,
        toAccountId: prev.toAccountId || accountList[1].id,
      }
    })
  }

  const load = async () => {
    try {
      const [transferRes, accountRes] = await Promise.all([
        api.get('/transfers?limit=50'),
        api.get('/accounts'),
      ])
      setTransfers(transferRes.data.transfers)
      setAccounts(accountRes.data.accounts)
      setDefaultAccounts(accountRes.data.accounts)
    } catch (error) {
      toast.error(error.message || t('transfers.toasts.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  useEffect(() => {
    if (!form.fromAccountId) return
    if (form.toAccountId && form.toAccountId !== form.fromAccountId) return

    const alternative = accounts.find((a) => a.id !== form.fromAccountId)
    if (!alternative) return

    setForm((prev) => ({
      ...prev,
      toAccountId: alternative.id,
    }))
  }, [accounts, form.fromAccountId, form.toAccountId])

  useEffect(() => {
    let canceled = false

    const loadQuote = async () => {
      const amountValue = Number.parseFloat(form.fromAmount || 0)
      if (!form.fromAccountId || !form.toAccountId || form.fromAccountId === form.toAccountId || !amountValue || amountValue <= 0) {
        setQuote({ loading: false, error: '', data: null })
        return
      }

      setQuote((prev) => ({ ...prev, loading: true, error: '' }))
      try {
        const query = `fromAccountId=${encodeURIComponent(form.fromAccountId)}&toAccountId=${encodeURIComponent(form.toAccountId)}&amount=${encodeURIComponent(amountValue)}`
        const res = await api.get(`/transfers/quote?${query}`)
        if (canceled) return
        setQuote({ loading: false, error: '', data: res?.data || null })
      } catch (error) {
        if (canceled) return
        setQuote({ loading: false, error: error.message || t('transfers.toasts.rateUnavailable'), data: null })
      }
    }

    loadQuote()

    return () => {
      canceled = true
    }
  }, [form.fromAccountId, form.toAccountId, form.fromAmount, t])

  const fromAccount = accounts.find((a) => a.id === form.fromAccountId)
  const toAccount = accounts.find((a) => a.id === form.toAccountId)
  const isDifferentCurrency = fromAccount && toAccount && fromAccount.currency !== toAccount.currency
  const quoteData = quote.data
  const previewFromAmount = Number.parseFloat(quoteData?.fromAmount ?? form.fromAmount ?? 0) || 0
  const previewToAmount = Number.parseFloat(quoteData?.toAmount ?? 0) || 0
  const fromBalance = Number.parseFloat(fromAccount?.balance || 0) || 0
  const toBalance = Number.parseFloat(toAccount?.balance || 0) || 0
  const hasInsufficientFunds = Boolean(fromAccount) && previewFromAmount > 0 && fromBalance < previewFromAmount
  const submitDisabled = saving || quote.loading || !quoteData || hasInsufficientFunds

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (accounts.length < 2) {
      toast.error(t('transfers.toasts.needAccounts'))
      return
    }
    if (!form.fromAmount || Number.parseFloat(form.fromAmount) <= 0) {
      toast.error(t('transfers.toasts.invalidAmount'))
      return
    }
    if (!form.fromAccountId || !form.toAccountId) {
      toast.error(t('transfers.toasts.selectAccounts'))
      return
    }
    if (form.fromAccountId === form.toAccountId) {
      toast.error(t('transfers.toasts.sameAccount'))
      return
    }
    if (!quoteData) {
      toast.error(quote.error || t('transfers.toasts.rateUnavailable'))
      return
    }
    if (hasInsufficientFunds) {
      toast.error(t('transfers.toasts.insufficientFunds'))
      return
    }

    setSaving(true)
    try {
      await api.post('/transfers', {
        fromAccountId: form.fromAccountId,
        toAccountId: form.toAccountId,
        fromAmount: Number.parseFloat(quoteData.fromAmount || form.fromAmount),
        date: form.date,
        note: form.note || undefined,
      })
      toast.success(t('transfers.toasts.success'))
      setModalOpen(false)
      setForm((prev) => ({ ...prev, fromAmount: '', date: getToday(), note: '' }))
      setQuote({ loading: false, error: '', data: null })
      await load()
    } catch (error) {
      toast.error(error.message || t('transfers.toasts.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transfers/${id}`)
      setDeleteConfirm(null)
      toast.success(t('transfers.toasts.deleted'))
      await load()
    } catch (error) {
      toast.error(error.message || t('transfers.toasts.loadError'))
    }
  }

  if (loading) {
    return (
      <div className="p-6 flex justify-center">
        <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white mb-1">{t('transfers.quick')}</h3>
            <p className="text-sm text-gray-500">{t('transfers.accountsCount', { count: formatNumber(accounts.length) })}</p>
          </div>
          <button onClick={() => setModalOpen(true)} disabled={accounts.length < 2} className="flex items-center gap-2 px-4 py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-medium text-sm shadow-lg shadow-primary-500/25 transition-all disabled:opacity-50">
            <Plus className="w-4 h-4" /> {t('transfers.new')}
          </button>
        </div>
      </div>

      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-700/50">
          <h3 className="font-semibold text-white">{t('transfers.history')}</h3>
        </div>

        {transfers.length === 0 ? (
          <div className="p-10 text-center text-gray-500 text-sm">{t('transfers.empty')}</div>
        ) : transfers.map((tr) => (
          <div key={tr.id} className="flex items-center justify-between px-5 py-4 hover:bg-gray-700/20 transition-colors border-b border-gray-700/30 last:border-0 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
                <ArrowLeftRight className="w-5 h-5 text-primary-400" />
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-white">{tr.from_account_name}</span>
                  <ArrowRight className="w-3.5 h-3.5 text-gray-400" />
                  <span className="font-medium text-white">{tr.to_account_name}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{(tr.date || '').split('T')[0]}{tr.note ? ` | ${tr.note}` : ''}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-sm font-semibold font-mono text-danger-400">-{formatMoney(tr.from_amount, { currency: tr.from_currency })}</p>
                {tr.from_currency !== tr.to_currency && (
                  <p className="text-xs font-mono text-success-400 mt-0.5">+{formatMoney(tr.to_amount, { currency: tr.to_currency })}</p>
                )}
              </div>
              <button onClick={() => setDeleteConfirm(tr)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger-500/10 text-gray-500 hover:text-danger-400 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
              <h3 className="text-lg font-semibold text-white">{t('transfers.newTitle')}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-700/50 transition-colors"><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transfers.fields.from')}</label>
                <select value={form.fromAccountId} onChange={(e) => setForm({ ...form, fromAccountId: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} - {formatMoney(a.balance, { currency: a.currency })}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transfers.fields.to')}</label>
                <select value={form.toAccountId} onChange={(e) => setForm({ ...form, toAccountId: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                  {accounts.filter((a) => a.id !== form.fromAccountId).map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transfers.fields.amount')} {fromAccount ? `(${fromAccount.currency})` : ''}</label>
                <FormattedNumberInput
                  placeholder="0"
                  value={form.fromAmount}
                  onChange={(next) => setForm({ ...form, fromAmount: next })}
                  allowDecimal
                  maxDecimals={2}
                  className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              {form.fromAmount && fromAccount && toAccount && (
                <div className="p-3 rounded-xl bg-primary-500/10 border border-primary-500/20 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{fromAccount.name}</span>
                    <span className="font-semibold text-danger-400">-{formatMoney(previewFromAmount, { currency: fromAccount.currency })}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-400">{toAccount.name}</span>
                    <span className="font-semibold text-success-400">+{formatMoney(previewToAmount, { currency: toAccount.currency })}</span>
                  </div>

                  {quote.loading && (
                    <p className="text-[11px] text-gray-500">{t('common.loading')}</p>
                  )}

                  {!quote.loading && quote.error && (
                    <p className="text-[11px] text-danger-400">{quote.error}</p>
                  )}

                  {!quote.loading && quoteData && (
                    <>
                      {isDifferentCurrency && (
                        <p className="text-[11px] text-gray-500">
                          {t('transfers.fields.autoRate', {
                            from: fromAccount.currency,
                            rate: Number(quoteData.exchangeRate || 0).toFixed(6),
                            to: toAccount.currency,
                          })}
                        </p>
                      )}

                      <div className="pt-2 border-t border-primary-500/20 space-y-1">
                        <p className="text-[11px] text-gray-500">{t('transfers.fields.afterTransfer')}</p>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">{t('transfers.fields.fromAfter')}</span>
                          <span className={hasInsufficientFunds ? 'text-danger-400' : 'text-gray-300'}>
                            {formatMoney(fromBalance - previewFromAmount, { currency: fromAccount.currency })}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-gray-400">{t('transfers.fields.toAfter')}</span>
                          <span className="text-gray-300">
                            {formatMoney(toBalance + previewToAmount, { currency: toAccount.currency })}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transfers.fields.date')}</label>
                  <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transfers.fields.note')}</label>
                  <input type="text" placeholder={t('transfers.fields.notePlaceholder')} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm font-medium text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={submitDisabled} className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">{saving ? '...' : t('transfers.submit')}</button>
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
              <h3 className="text-lg font-semibold text-white mb-1">{t('transfers.delete.title')}</h3>
              <p className="text-sm text-gray-400">{t('transfers.delete.text', { from: deleteConfirm.from_account_name, to: deleteConfirm.to_account_name })}</p>
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
