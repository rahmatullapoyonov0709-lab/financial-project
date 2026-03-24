const db = require('../config/db');
const { logAudit } = require('../services/auditService');
const { resolveScopeUserId } = require('../services/householdScopeService');
const { ensureBudgetNotificationsForUser } = require('../services/budgetNotificationService');

const parsePositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const triggerBudgetNotifications = async (userId) => {
  try {
    await ensureBudgetNotificationsForUser(userId);
  } catch {
    // Budget alert generation should not block budget CRUD responses.
  }
};

const getBudgets = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const month = parsePositiveInt(req.query.month, new Date().getMonth() + 1);
    const year = parsePositiveInt(req.query.year, new Date().getFullYear());
    if (month < 1 || month > 12) {
      return res.status(400).json({ success: false, error: 'Oy 1 va 12 oraligida bolishi kerak' });
    }
    if (year < 2000 || year > 2100) {
      return res.status(400).json({ success: false, error: 'Yil notogri' });
    }

    const { rows } = await db.query(
      `SELECT b.id, b.month, b.year, b.limit_amount, b.type, b.category_id,
        c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
        COALESCE(s.total, 0) AS spent_amount,
        (b.limit_amount - COALESCE(s.total, 0)) AS remaining,
        CASE WHEN b.limit_amount > 0
          THEN ROUND((COALESCE(s.total, 0) / b.limit_amount) * 100, 1)
          ELSE 0
        END AS usage_percent,
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
           AND EXTRACT(MONTH FROM t.date) = b.month
           AND EXTRACT(YEAR FROM t.date) = b.year
       ) s ON TRUE
      WHERE b.user_id = $1 AND b.month = $2 AND b.year = $3
       ORDER BY usage_percent DESC`,
      [scopeUserId, month, year]
    );

    res.json({
      success: true,
      data: {
        budgets: rows,
        period: { month, year }
      }
    });
  } catch (error) {
    next(error);
  }
};

const createBudget = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { categoryId, month, year, limitAmount, type = 'EXPENSE' } = req.body;
    const normalizedMonth = parsePositiveInt(month, null);
    const normalizedYear = parsePositiveInt(year, null);
    const normalizedLimit = Number.parseFloat(limitAmount);

    if (!normalizedMonth || normalizedMonth < 1 || normalizedMonth > 12) {
      return res.status(400).json({ success: false, error: 'Oy notogri' });
    }
    if (!normalizedYear || normalizedYear < 2000 || normalizedYear > 2100) {
      return res.status(400).json({ success: false, error: 'Yil notogri' });
    }
    if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
      return res.status(400).json({ success: false, error: 'Limit summasi notogri' });
    }

    const catR = await db.query(
      'SELECT id, type FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2)',
      [categoryId, scopeUserId]
    );
    if (!catR.rows.length) {
      return res.status(400).json({ success: false, error: 'Kategoriya topilmadi' });
    }
    if (catR.rows[0].type !== type) {
      return res.status(400).json({ success: false, error: 'Byudjet turi kategoriya turiga mos emas' });
    }

    const { rows } = await db.query(
      'INSERT INTO budgets (user_id, category_id, month, year, limit_amount, type) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [scopeUserId, categoryId, normalizedMonth, normalizedYear, normalizedLimit, type]
    );

    await logAudit({
      req,
      userId: req.user.id,
      action: 'BUDGET_CREATE',
      entity: 'budget',
      entityId: rows[0].id,
      metadata: { month: normalizedMonth, year: normalizedYear, limitAmount: normalizedLimit },
    });

    await triggerBudgetNotifications(req.user.id);

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateBudget = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const normalizedLimit = Number.parseFloat(req.body.limitAmount);
    if (!Number.isFinite(normalizedLimit) || normalizedLimit <= 0) {
      return res.status(400).json({ success: false, error: 'Limit summasi notogri' });
    }

    const { rows } = await db.query(
      'UPDATE budgets SET limit_amount = $1 WHERE id = $2 AND user_id = $3 RETURNING *',
      [normalizedLimit, req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'BUDGET_UPDATE',
      entity: 'budget',
      entityId: rows[0].id,
      metadata: { limitAmount: rows[0].limit_amount },
    });

    await triggerBudgetNotifications(req.user.id);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteBudget = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { rows } = await db.query(
      'DELETE FROM budgets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'BUDGET_DELETE',
      entity: 'budget',
      entityId: req.params.id,
    });

    await triggerBudgetNotifications(req.user.id);

    res.json({ success: true, message: 'Byudjet ochirildi' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getBudgets, createBudget, updateBudget, deleteBudget };
