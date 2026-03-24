import { useState, useEffect, useMemo } from 'react'
import { Plus, X, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../api'
import FormattedNumberInput from '../components/FormattedNumberInput'
import { useAppSettings } from '../context/AppSettingsContext'
import { translateCategoryName } from '../utils/categoryTranslations'

const CAT_ICONS = {
  'Oziq-ovqat': '\u{1F6D2}',
  Transport: '\u{1F695}',
  Kommunal: '\u{26A1}',
  Soglik: '\u{1F48A}',
  Kiyim: '\u{1F457}',
  Restoran: '\u{1F354}',
  "Ko'ngil ochar": '\u{1F3AC}',
  'Kengil ochar': '\u{1F3AC}',
  Talim: '\u{1F4DA}',
  Aloqa: '\u{1F4F1}',
  Sayohat: '\u{2708}\u{FE0F}',
  Boshqa: '\u{1F4E6}',
  'Ish haqi': '\u{1F4BC}',
  Frilanserlik: '\u{1F4BB}',
  Investitsiya: '\u{1F4C8}',
  'Boshqa daromad': '\u{1F4B5}',
}
const getIcon = (name) => CAT_ICONS[name] || '\u{1F4CA}'
const QUICK_TYPE_KEY = 'fintrack:transactions:quick-type'

export default function Transactions() {
  const { t, formatMoney, currency } = useAppSettings()
  const [transactions, setTransactions] = useState([])
  const [accounts, setAccounts] = useState([])
  const [categories, setCategories] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quote, setQuote] = useState(null)
  const [form, setForm] = useState({
    type: 'EXPENSE',
    amount: '',
    inputCurrency: 'UZS',
    accountId: '',
    categoryId: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
  })

  const load = async () => {
    try {
      const base = new URLSearchParams({ baseCurrency: currency }).toString()
      const [txRes, accRes, catRes] = await Promise.all([
        api.get('/transactions?limit=50' + (filter ? `&type=${filter}` : '') + `&${base}`),
        api.get(`/accounts?${base}`),
        api.get('/categories'),
      ])

      setTransactions(txRes.data.transactions)
      setAccounts(accRes.data.accounts)
      setCategories(catRes.data.categories)

      if (!form.accountId && accRes.data.accounts.length > 0) {
        setForm((prev) => ({ ...prev, accountId: accRes.data.accounts[0].id }))
      }
    } catch (error) {
      toast.error(error.message || t('transactions.loadError'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filter, currency])

  useEffect(() => {
    const quickType = localStorage.getItem(QUICK_TYPE_KEY)
    if (quickType === 'INCOME' || quickType === 'EXPENSE') {
      setForm((prev) => ({
        ...prev,
        type: quickType,
        categoryId: '',
      }))
      setModalOpen(true)
      localStorage.removeItem(QUICK_TYPE_KEY)
    }
  }, [])

  const currentCats = useMemo(
    () => categories.filter((category) => category.type === form.type),
    [categories, form.type],
  )
  const selectedAccount = useMemo(
    () => accounts.find((account) => account.id === form.accountId) || null,
    [accounts, form.accountId],
  )

  useEffect(() => {
    let cancelled = false
    const amount = Number.parseFloat(form.amount)
    if (!modalOpen || !form.accountId || !amount || amount <= 0) {
      setQuote(null)
      setQuoteLoading(false)
      return () => {}
    }

    const loadQuote = async () => {
      setQuoteLoading(true)
      try {
        const query = new URLSearchParams({
          amount: String(amount),
          accountId: form.accountId,
          inputCurrency: form.inputCurrency || 'UZS',
        }).toString()
        const res = await api.get(`/transactions/quote?${query}`)
        if (!cancelled) {
          setQuote(res?.data || null)
        }
      } catch {
        if (!cancelled) {
          setQuote(null)
        }
      } finally {
        if (!cancelled) {
          setQuoteLoading(false)
        }
      }
    }

    const timer = setTimeout(loadQuote, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [modalOpen, form.amount, form.accountId, form.inputCurrency])

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!form.amount || !form.accountId || !form.categoryId) {
      toast.error(t('transactions.requiredFields'))
      return
    }

    setSaving(true)
    try {
      await api.post('/transactions', {
        type: form.type,
        amount: Number.parseFloat(form.amount),
        inputCurrency: form.inputCurrency || 'UZS',
        accountId: form.accountId,
        categoryId: form.categoryId,
        description: form.description,
        date: form.date,
      })

      toast.success(form.type === 'INCOME' ? t('transactions.incomeAdded') : t('transactions.expenseAdded'))
      setModalOpen(false)
      setForm({
        type: 'EXPENSE',
        amount: '',
        inputCurrency: 'UZS',
        accountId: accounts[0]?.id || '',
        categoryId: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
      })
      await load()
    } catch (error) {
      toast.error(error.message || t('transactions.loadError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api.delete(`/transactions/${id}`)
      toast.success(t('transactions.deleted'))
      await load()
    } catch (error) {
      toast.error(error.message || t('transactions.loadError'))
    }
  }

  if (loading) {
    return <div className="p-6 flex justify-center"><div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin" /></div>
  }

  return (
    <div className="p-4 lg:p-6 space-y-4">
      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-2">
            {[
              { v: '', l: t('transactions.filters.all') },
              { v: 'INCOME', l: t('transactions.filters.income') },
              { v: 'EXPENSE', l: t('transactions.filters.expense') },
            ].map((item) => (
              <button
                key={item.v}
                onClick={() => setFilter(item.v)}
                className={"px-3 py-1.5 rounded-lg text-xs font-medium transition-colors " + (
                  filter === item.v
                    ? item.v === 'INCOME'
                      ? 'bg-success-500 text-white'
                      : item.v === 'EXPENSE'
                        ? 'bg-danger-500 text-white'
                        : 'bg-primary-500 text-white'
                    : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                )}
              >
                {item.l}
              </button>
            ))}
          </div>
          <button onClick={() => setModalOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-primary-500/25">
            <Plus className="w-4 h-4" /> {t('transactions.new')}
          </button>
        </div>
      </div>

      <div className="bg-dark-800 rounded-2xl border border-gray-700/50 overflow-hidden">
        {transactions.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500 text-sm">{t('transactions.emptyTitle')}</p>
            <button onClick={() => setModalOpen(true)} className="mt-3 text-primary-400 text-sm hover:text-primary-300">{t('transactions.addFirst')}</button>
          </div>
        ) : transactions.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-700/10 transition-colors border-b border-gray-800/50 last:border-0 group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xs" style={{ backgroundColor: (tx.category_color || '#6366F1') + '18' }}>
                {getIcon(tx.category_name)}
              </div>
              <div>
                <p className="text-sm font-medium text-white">{translateCategoryName(tx.category_name, t)}</p>
                <p className="text-xs text-gray-500">{t('transactions.categoryAccountDate', {
                  account: tx.account_name,
                  description: tx.description || t('common.noData'),
                  date: tx.date?.split('T')[0],
                })}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className={"text-sm font-semibold font-mono " + (tx.type === 'INCOME' ? 'text-success-400' : 'text-danger-400')}>
                {tx.type === 'INCOME' ? '+' : '-'}{formatMoney(tx.amount, { currency: tx.account_currency })}
              </span>
              <button onClick={() => handleDelete(tx.id)} className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-danger-500/10 text-gray-500 hover:text-danger-400 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-dark-800 rounded-2xl shadow-2xl w-full max-w-md border border-gray-700/50 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50 sticky top-0 bg-dark-800">
              <h3 className="text-lg font-semibold text-white">{t('transactions.newTransaction')}</h3>
              <button onClick={() => setModalOpen(false)} className="p-2 rounded-xl hover:bg-gray-700/50"><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'EXPENSE', categoryId: '' })}
                  className={"flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all " + (form.type === 'EXPENSE' ? 'border-danger-500 bg-danger-500/10 text-danger-400' : 'border-gray-700 text-gray-500')}
                >
                  <TrendingDown className="w-4 h-4" /> {t('transactions.filters.expense')}
                </button>
                <button
                  type="button"
                  onClick={() => setForm({ ...form, type: 'INCOME', categoryId: '' })}
                  className={"flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border-2 transition-all " + (form.type === 'INCOME' ? 'border-success-500 bg-success-500/10 text-success-400' : 'border-gray-700 text-gray-500')}
                >
                  <TrendingUp className="w-4 h-4" /> {t('transactions.filters.income')}
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transactions.amount')}</label>
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
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('currency.label')}</label>
                <select
                  value={form.inputCurrency}
                  onChange={(e) => setForm({ ...form, inputCurrency: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                >
                  <option value="UZS">UZS</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="RUB">RUB</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transactions.account')}</label>
                <select value={form.accountId} onChange={(e) => setForm({ ...form, accountId: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                  <option value="">{t('transactions.select')}</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.name} ({account.currency})</option>
                  ))}
                </select>
              </div>

              {(quoteLoading || quote) && (
                <div className="rounded-xl border border-primary-500/30 bg-primary-500/10 px-3 py-2 text-xs text-primary-100">
                  {quoteLoading && <p>{t('common.loading')}</p>}
                  {!quoteLoading && quote && (
                    <>
                      <p>
                        {formatMoney(quote.inputAmount, { currency: quote.inputCurrency })}
                        {' -> '}
                        {formatMoney(quote.accountAmount, { currency: quote.accountCurrency })}
                      </p>
                      <p className="mt-1 text-primary-200">
                        Kurs: 1 {quote.inputCurrency} = {quote.exchangeRate.toFixed(6)} {quote.accountCurrency}
                      </p>
                      {form.type === 'EXPENSE' && selectedAccount && (
                        <p className="mt-1 text-primary-200">
                          Hisobdan yechiladi: {formatMoney(quote.accountAmount, { currency: selectedAccount.currency })}
                        </p>
                      )}
                    </>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transactions.category')}</label>
                <select value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                  <option value="">{t('transactions.select')}</option>
                  {currentCats.map((category) => (
                    <option key={category.id} value={category.id}>{getIcon(category.name)} {translateCategoryName(category.name, t)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transactions.description')}</label>
                <input
                  type="text"
                  placeholder={t('transactions.descriptionPlaceholder')}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">{t('transactions.date')}</label>
                <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="w-full rounded-xl border border-gray-700 bg-dark-900 px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setModalOpen(false)} className="flex-1 py-2.5 rounded-xl border border-gray-700 text-sm text-gray-400 hover:bg-gray-700/50 transition-colors">{t('common.cancel')}</button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl bg-primary-500 hover:bg-primary-600 text-white text-sm font-medium transition-colors disabled:opacity-50">{saving ? '...' : t('transactions.add')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
