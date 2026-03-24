const db = require('../config/db');
const { resolveScopeUserId } = require('../services/householdScopeService');
const { getRatesWithLiveFallback, getRate, SUPPORTED_CURRENCIES } = require('../services/fxService');

const VALID_TYPES = new Set(['INCOME', 'EXPENSE']);
const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly', 'yearly']);

const normalizeCurrency = (value, fallback = 'UZS') => {
  const code = String(value || '').trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : fallback;
};

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const convertAmount = ({ amount, fromCurrency, toCurrency, rates }) => {
  const conversion = getRate(fromCurrency, toCurrency, rates);
  if (conversion?.error) return 0;
  const rate = conversion?.rate || 1;
  return toNumber(amount) * rate;
};

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const normalizeDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
};

const parseDateRange = (query) => {
  const from = query.from ? normalizeDate(query.from) : null;
  const to = query.to ? normalizeDate(query.to) : null;

  if (query.from && !from) {
    return { error: 'from sanasi notogri (YYYY-MM-DD)' };
  }
  if (query.to && !to) {
    return { error: 'to sanasi notogri (YYYY-MM-DD)' };
  }
  if (from && to && from > to) {
    return { error: 'from sanasi to dan katta bolmasligi kerak' };
  }

  return { from, to };
};

const parseMonthYear = (query) => {
  const current = new Date();
  const month = parsePositiveInt(query.month, current.getMonth() + 1);
  const year = parsePositiveInt(query.year, current.getFullYear());

  if (month < 1 || month > 12) {
    return { error: 'Oy 1 va 12 oraligida bolishi kerak' };
  }
  if (year < 2000 || year > 2100) {
    return { error: 'Yil notogri' };
  }

  return { month, year };
};

const toDateString = (value) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).slice(0, 10);
};

const getSummary = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const dateRange = parseDateRange(req.query);
    if (dateRange.error) {
      return res.status(400).json({ success: false, error: dateRange.error });
    }
    const baseCurrency = normalizeCurrency(req.query.baseCurrency, 'UZS');

    const params = [scopeUserId];
    const conds = ['t.user_id = $1'];
    let idx = 2;

    if (dateRange.from) { conds.push('t.date >= $' + idx); params.push(dateRange.from); idx++; }
    if (dateRange.to) { conds.push('t.date <= $' + idx); params.push(dateRange.to); idx++; }

    const where = conds.join(' AND ');

    const totalsR = await db.query(
      `SELECT a.currency AS currency,
        COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0) AS total_income,
        COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) AS total_expense
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE ${where}
       GROUP BY a.currency`,
      params
    );

    const countR = await db.query(
      'SELECT COUNT(*) AS count FROM transactions t WHERE ' + where,
      params
    );

    const accs = await db.query(
      'SELECT id, name, type, currency, balance FROM accounts WHERE user_id = $1 ORDER BY balance DESC',
      [scopeUserId]
    );

    const rates = await getRatesWithLiveFallback();
    const totalsByCurrency = totalsR.rows.map((row) => ({
      currency: row.currency,
      totalIncome: toNumber(row.total_income),
      totalExpense: toNumber(row.total_expense),
    }));
    const totalIncomeBase = totalsByCurrency.reduce(
      (sum, row) => sum + convertAmount({ amount: row.totalIncome, fromCurrency: row.currency, toCurrency: baseCurrency, rates }),
      0
    );
    const totalExpenseBase = totalsByCurrency.reduce(
      (sum, row) => sum + convertAmount({ amount: row.totalExpense, fromCurrency: row.currency, toCurrency: baseCurrency, rates }),
      0
    );

    const byAccount = accs.rows.map((a) => ({
      ...a,
      base_currency: baseCurrency,
      base_balance: convertAmount({ amount: a.balance, fromCurrency: a.currency, toCurrency: baseCurrency, rates }),
    }));
    const totalBalanceBase = byAccount.reduce((sum, a) => sum + toNumber(a.base_balance), 0);

    res.json({
      success: true,
      data: {
        baseCurrency,
        totalsByCurrency,
        totalBalance: totalBalanceBase,
        totalIncome: totalIncomeBase,
        totalExpense: totalExpenseBase,
        netBalance: totalIncomeBase - totalExpenseBase,
        transactionCount: parseInt(countR.rows[0].count, 10),
        byAccount,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getByCategory = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const dateRange = parseDateRange(req.query);
    if (dateRange.error) {
      return res.status(400).json({ success: false, error: dateRange.error });
    }
    const baseCurrency = normalizeCurrency(req.query.baseCurrency, 'UZS');

    const type = req.query.type || 'EXPENSE';
    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: 'type notogri' });
    }

    const params = [scopeUserId, type];
    const conds = ['t.user_id = $1', 't.type = $2'];
    let idx = 3;

    if (dateRange.from) { conds.push('t.date >= $' + idx); params.push(dateRange.from); idx++; }
    if (dateRange.to) { conds.push('t.date <= $' + idx); params.push(dateRange.to); idx++; }

    const { rows } = await db.query(
      `SELECT c.id AS category_id, c.name, c.icon, c.color, a.currency AS currency,
        SUM(t.amount) AS total, COUNT(t.id) AS transaction_count
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       JOIN accounts a ON a.id = t.account_id
       WHERE ${conds.join(' AND ')}
       GROUP BY c.id, c.name, c.icon, c.color, a.currency
       ORDER BY total DESC`,
      params
    );

    const rates = await getRatesWithLiveFallback();
    const map = new Map();
    rows.forEach((row) => {
      const key = row.category_id;
      const prev = map.get(key) || {
        category_id: row.category_id,
        name: row.name,
        icon: row.icon,
        color: row.color,
        total: 0,
        transaction_count: 0,
      };
      prev.total += convertAmount({ amount: row.total, fromCurrency: row.currency, toCurrency: baseCurrency, rates });
      prev.transaction_count += Number.parseInt(row.transaction_count, 10) || 0;
      map.set(key, prev);
    });
    const aggregated = Array.from(map.values()).sort((a, b) => b.total - a.total);
    const grandTotal = aggregated.reduce((sum, row) => sum + toNumber(row.total), 0);
    const withPercent = aggregated.map((row) => ({
      ...row,
      baseCurrency,
      percentage: grandTotal > 0 ? Math.round((toNumber(row.total) / grandTotal) * 1000) / 10 : 0,
    }));

    res.json({ success: true, data: withPercent });
  } catch (error) {
    next(error);
  }
};

const getByPeriod = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const dateRange = parseDateRange(req.query);
    if (dateRange.error) {
      return res.status(400).json({ success: false, error: dateRange.error });
    }
    const baseCurrency = normalizeCurrency(req.query.baseCurrency, 'UZS');

    const period = req.query.period || 'monthly';
    if (!VALID_PERIODS.has(period)) {
      return res.status(400).json({ success: false, error: 'period notogri' });
    }

    const params = [scopeUserId];
    const conds = ['t.user_id = $1'];
    let idx = 2;

    if (dateRange.from) { conds.push('t.date >= $' + idx); params.push(dateRange.from); idx++; }
    if (dateRange.to) { conds.push('t.date <= $' + idx); params.push(dateRange.to); idx++; }

    let dateExpr = "TO_CHAR(t.date, 'YYYY-MM')";
    if (period === 'daily') dateExpr = "TO_CHAR(t.date, 'YYYY-MM-DD')";
    if (period === 'weekly') dateExpr = "TO_CHAR(DATE_TRUNC('week', t.date), 'YYYY-\"W\"IW')";
    if (period === 'yearly') dateExpr = "TO_CHAR(t.date, 'YYYY')";

    const { rows } = await db.query(
      `SELECT ${dateExpr} AS period, a.currency AS currency,
        COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN t.type = 'EXPENSE' THEN t.amount ELSE 0 END), 0) AS expense,
        COUNT(t.id) AS transaction_count
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       WHERE ${conds.join(' AND ')}
       GROUP BY ${dateExpr}, a.currency
       ORDER BY ${dateExpr} ASC`,
      params
    );

    const rates = await getRatesWithLiveFallback();
    const byPeriodMap = new Map();
    rows.forEach((row) => {
      const key = row.period;
      const prev = byPeriodMap.get(key) || {
        period: row.period,
        income: 0,
        expense: 0,
        transaction_count: 0,
        baseCurrency,
      };
      prev.income += convertAmount({ amount: row.income, fromCurrency: row.currency, toCurrency: baseCurrency, rates });
      prev.expense += convertAmount({ amount: row.expense, fromCurrency: row.currency, toCurrency: baseCurrency, rates });
      prev.transaction_count += Number.parseInt(row.transaction_count, 10) || 0;
      byPeriodMap.set(key, prev);
    });

    res.json({ success: true, data: Array.from(byPeriodMap.values()) });
  } catch (error) {
    next(error);
  }
};

const getBudgetVsActual = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const period = parseMonthYear(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }

    const { rows } = await db.query(
      `SELECT b.id AS budget_id, b.limit_amount AS budget,
        c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
        COALESCE(s.total, 0) AS spent,
        (b.limit_amount - COALESCE(s.total, 0)) AS remaining,
        CASE WHEN b.limit_amount > 0
          THEN ROUND((COALESCE(s.total, 0) / b.limit_amount) * 100, 1)
          ELSE 0
        END AS percent,
        CASE WHEN COALESCE(s.total, 0) > b.limit_amount * 0.9
          THEN TRUE ELSE FALSE
        END AS warning
       FROM budgets b
       LEFT JOIN categories c ON c.id = b.category_id
       LEFT JOIN LATERAL (
         SELECT SUM(t.amount) AS total
         FROM transactions t
         WHERE t.user_id = b.user_id
           AND t.category_id = b.category_id
           AND t.type = 'EXPENSE'
           AND EXTRACT(MONTH FROM t.date) = $2
           AND EXTRACT(YEAR FROM t.date) = $3
       ) s ON TRUE
       WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
       ORDER BY percent DESC`,
      [scopeUserId, period.month, period.year]
    );

    res.json({
      success: true,
      data: { items: rows, period: { month: period.month, year: period.year } },
    });
  } catch (error) {
    next(error);
  }
};

const getCalendar = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const period = parseMonthYear(req.query);
    if (period.error) {
      return res.status(400).json({ success: false, error: period.error });
    }

    const summaryR = await db.query(
      'SELECT t.date, COALESCE(SUM(CASE WHEN t.type = \'INCOME\' THEN t.amount ELSE 0 END), 0) AS total_income, COALESCE(SUM(CASE WHEN t.type = \'EXPENSE\' THEN t.amount ELSE 0 END), 0) AS total_expense, COUNT(t.id) AS transaction_count FROM transactions t WHERE t.user_id = $1 AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3 GROUP BY t.date ORDER BY t.date',
      [scopeUserId, period.month, period.year]
    );

    const detailR = await db.query(
      'SELECT t.id, t.date, t.type, t.amount, t.description, c.name AS category_name, c.icon AS category_icon, c.color AS category_color, a.name AS account_name FROM transactions t JOIN categories c ON c.id = t.category_id JOIN accounts a ON a.id = t.account_id WHERE t.user_id = $1 AND EXTRACT(MONTH FROM t.date) = $2 AND EXTRACT(YEAR FROM t.date) = $3 ORDER BY t.date, t.created_at DESC',
      [scopeUserId, period.month, period.year]
    );

    const calendarMap = {};
    summaryR.rows.forEach((row) => {
      const dateKey = toDateString(row.date);
      calendarMap[dateKey] = {
        date: dateKey,
        totalIncome: parseFloat(row.total_income),
        totalExpense: parseFloat(row.total_expense),
        transactionCount: parseInt(row.transaction_count, 10),
        transactions: [],
      };
    });

    detailR.rows.forEach((tx) => {
      const dateKey = toDateString(tx.date);
      if (calendarMap[dateKey]) {
        calendarMap[dateKey].transactions.push({
          id: tx.id,
          type: tx.type,
          amount: parseFloat(tx.amount),
          description: tx.description,
          categoryName: tx.category_name,
          categoryIcon: tx.category_icon,
          categoryColor: tx.category_color,
          accountName: tx.account_name,
        });
      }
    });

    res.json({
      success: true,
      data: { calendar: Object.values(calendarMap), period: { month: period.month, year: period.year } },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getSummary, getByCategory, getByPeriod, getBudgetVsActual, getCalendar };
