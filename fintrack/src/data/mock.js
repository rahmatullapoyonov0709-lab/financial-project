export const ACCOUNTS = [
  { id: '1', name: 'Naqd pul', type: 'CASH', currency: 'UZS', balance: 3500000 },
  { id: '2', name: 'Uzcard', type: 'BANK_CARD', currency: 'UZS', balance: 12750000 },
  { id: '3', name: 'Dollar hisobi', type: 'SAVINGS', currency: 'USD', balance: 850 },
]

export const CATEGORIES = {
  expense: [
    { id: 'c1', name: 'Oziq-ovqat', icon: '🛒', color: '#FF6B35' },
    { id: 'c2', name: 'Transport', icon: '🚕', color: '#004E89' },
    { id: 'c3', name: 'Kommunal', icon: '⚡', color: '#FB5607' },
    { id: 'c4', name: "Sog'liq", icon: '💊', color: '#06D6A0' },
    { id: 'c5', name: 'Kiyim-kechak', icon: '👗', color: '#E91E63' },
    { id: 'c6', name: 'Restoran', icon: '🍔', color: '#FF5722' },
    { id: 'c7', name: "Ko'ngil ochar", icon: '🎬', color: '#9C27B0' },
    { id: 'c8', name: "Ta'lim", icon: '📚', color: '#118AB2' },
    { id: 'c9', name: 'Aloqa', icon: '📱', color: '#607D8B' },
    { id: 'c10', name: 'Sayohat', icon: '✈️', color: '#00BCD4' },
  ],
  income: [
    { id: 'i1', name: 'Ish haqi', icon: '💼', color: '#4CAF50' },
    { id: 'i2', name: 'Frilanserlik', icon: '💻', color: '#2196F3' },
    { id: 'i3', name: 'Investitsiya', icon: '📈', color: '#00C853' },
    { id: 'i4', name: 'Boshqa', icon: '💵', color: '#78909C' },
  ]
}

export const TRANSACTIONS = [
  { id: 't1', type: 'EXPENSE', amount: 285000, description: 'Haftalik bozor', date: '2025-01-20', category: CATEGORIES.expense[0], account: ACCOUNTS[1] },
  { id: 't2', type: 'EXPENSE', amount: 45000, description: 'Toshkent taksisi', date: '2025-01-19', category: CATEGORIES.expense[1], account: ACCOUNTS[0] },
  { id: 't3', type: 'INCOME', amount: 8500000, description: 'Ish haqi - Yanvar', date: '2025-01-18', category: CATEGORIES.income[0], account: ACCOUNTS[1] },
  { id: 't4', type: 'EXPENSE', amount: 120000, description: 'Oilaviy tushlik', date: '2025-01-17', category: CATEGORIES.expense[5], account: ACCOUNTS[1] },
  { id: 't5', type: 'EXPENSE', amount: 350000, description: 'Elektr va gaz', date: '2025-01-16', category: CATEGORIES.expense[2], account: ACCOUNTS[1] },
  { id: 't6', type: 'EXPENSE', amount: 65000, description: 'Beeline tarif', date: '2025-01-15', category: CATEGORIES.expense[8], account: ACCOUNTS[0] },
  { id: 't7', type: 'INCOME', amount: 2000000, description: 'Web sayt loyihasi', date: '2025-01-14', category: CATEGORIES.income[1], account: ACCOUNTS[0] },
  { id: 't8', type: 'EXPENSE', amount: 180000, description: 'Dorixona', date: '2025-01-13', category: CATEGORIES.expense[3], account: ACCOUNTS[1] },
  { id: 't9', type: 'EXPENSE', amount: 450000, description: 'Yangi kurtka', date: '2025-01-12', category: CATEGORIES.expense[4], account: ACCOUNTS[1] },
  { id: 't10', type: 'EXPENSE', amount: 80000, description: 'Kino', date: '2025-01-11', category: CATEGORIES.expense[6], account: ACCOUNTS[0] },
  { id: 't11', type: 'EXPENSE', amount: 500000, description: 'Ingliz tili kursi', date: '2025-01-10', category: CATEGORIES.expense[7], account: ACCOUNTS[1] },
  { id: 't12', type: 'INCOME', amount: 500000, description: 'Pul sovgasi', date: '2025-01-09', category: CATEGORIES.income[3], account: ACCOUNTS[0] },
]

export const DEBTS = [
  { id: 'd1', personName: 'Alisher', type: 'LENT', amount: 2000000, currency: 'UZS', status: 'OPEN', dueDate: '2025-02-15', description: 'Kvartira tamiri' },
  { id: 'd2', personName: 'Nodira', type: 'LENT', amount: 500000, currency: 'UZS', status: 'OPEN', dueDate: '2025-01-30', description: 'Dori uchun' },
  { id: 'd3', personName: 'Jasur', type: 'BORROWED', amount: 1000000, currency: 'UZS', status: 'OPEN', dueDate: '2025-02-28', description: 'Mashina tamiri' },
  { id: 'd4', personName: 'Shaxzod', type: 'LENT', amount: 300000, currency: 'UZS', status: 'CLOSED', dueDate: '2025-01-10', description: 'Tushlik' },
  { id: 'd5', personName: 'Madina', type: 'BORROWED', amount: 200, currency: 'USD', status: 'CLOSED', dueDate: '2025-01-05', description: 'Sayohat' },
]

export const BUDGETS = [
  { id: 'b1', category: CATEGORIES.expense[0], limit: 800000, spent: 760000 },
  { id: 'b2', category: CATEGORIES.expense[1], limit: 200000, spent: 80000 },
  { id: 'b3', category: CATEGORIES.expense[5], limit: 300000, spent: 215000 },
  { id: 'b4', category: CATEGORIES.expense[2], limit: 400000, spent: 350000 },
  { id: 'b5', category: CATEGORIES.expense[6], limit: 150000, spent: 80000 },
]

export const CHART_DATA = Array.from({ length: 20 }, (_, i) => ({
  period: `${i + 1}`,
  income: Math.floor(Math.random() * 3000000) + 500000,
  expense: Math.floor(Math.random() * 2500000) + 300000,
}))

export const PIE_DATA = [
  { name: 'Oziq-ovqat', value: 760000, icon: '🛒', color: '#FF6B35' },
  { name: 'Kommunal', value: 350000, icon: '⚡', color: '#FB5607' },
  { name: 'Transport', value: 280000, icon: '🚕', color: '#004E89' },
  { name: 'Kiyim', value: 450000, icon: '👗', color: '#E91E63' },
  { name: 'Restoran', value: 215000, icon: '🍔', color: '#FF5722' },
  { name: 'Boshqa', value: 350000, icon: '📦', color: '#9E9E9E' },
]

export const formatCurrency = (amount, currency = 'UZS') => {
  if (currency === 'USD') return `$${Number(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
  return `${Number(amount).toLocaleString('uz-UZ')} UZS`
}