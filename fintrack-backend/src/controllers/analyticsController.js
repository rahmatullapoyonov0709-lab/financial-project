const db = require('../config/db');
const { resolveScopeUserId } = require('../services/householdScopeService');

const VALID_TYPES = new Set(['INCOME', 'EXPENSE']);
const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly', 'yearly']);

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

    const params = [scopeUserId];
    const conds = ['user_id = $1'];
    let idx = 2;

    if (dateRange.from) { conds.push('date >= $' + idx); params.push(dateRange.from); idx++; }
    if (dateRange.to) { conds.push('date <= $' + idx); params.push(dateRange.to); idx++; }

    const where = conds.join(' AND ');

    const totalsR = await db.query(
      'SELECT COALESCE(SUM(CASE WHEN type = \'INCOME\' THEN amount ELSE 0 END), 0) AS total_income, COALESCE(SUM(CASE WHEN type = \'EXPENSE\' THEN amount ELSE 0 END), 0) AS total_expense FROM transactions WHERE ' + where,
      params
    );

    const countR = await db.query(
      'SELECT COUNT(*) AS count FROM transactions WHERE ' + where,
      params
    );

    const accs = await db.query(
      'SELECT id, name, type, currency, balance FROM accounts WHERE user_id = $1 ORDER BY balance DESC',
      [scopeUserId]
    );

    const { total_income, total_expense } = totalsR.rows[0];

    res.json({
      success: true,
      data: {
        totalIncome: parseFloat(total_income),
        totalExpense: parseFloat(total_expense),
        netBalance: parseFloat(total_income) - parseFloat(total_expense),
        transactionCount: parseInt(countR.rows[0].count, 10),
        byAccount: accs.rows,
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
      'SELECT c.id AS category_id, c.name, c.icon, c.color, SUM(t.amount) AS total, COUNT(t.id) AS transaction_count FROM transactions t JOIN categories c ON c.id = t.category_id WHERE ' + conds.join(' AND ') + ' GROUP BY c.id, c.name, c.icon, c.color ORDER BY total DESC',
      params
    );

    const grandTotal = rows.reduce((sum, row) => sum + parseFloat(row.total), 0);
    const withPercent = rows.map((row) => ({
      ...row,
      percentage: grandTotal > 0 ? Math.round((parseFloat(row.total) / grandTotal) * 1000) / 10 : 0,
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
      'SELECT ' + dateExpr + ' AS period, COALESCE(SUM(CASE WHEN t.type = \'INCOME\' THEN t.amount ELSE 0 END), 0) AS income, COALESCE(SUM(CASE WHEN t.type = \'EXPENSE\' THEN t.amount ELSE 0 END), 0) AS expense, COUNT(t.id) AS transaction_count FROM transactions t WHERE ' + conds.join(' AND ') + ' GROUP BY ' + dateExpr + ' ORDER BY ' + dateExpr + ' ASC',
      params
    );

    res.json({ success: true, data: rows });
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
