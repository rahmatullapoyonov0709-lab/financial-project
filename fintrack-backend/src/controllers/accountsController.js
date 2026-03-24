const db = require('../config/db');
const { logAudit } = require('../services/auditService');
const { reconcileBalances } = require('../services/reconcileService');
const { resolveScopeUserId } = require('../services/householdScopeService');
const { getRatesWithLiveFallback, getRate, SUPPORTED_CURRENCIES } = require('../services/fxService');

const normalizeCurrency = (value, fallback = 'UZS') => {
  const code = String(value || '').trim().toUpperCase();
  return SUPPORTED_CURRENCIES.includes(code) ? code : fallback;
};

const getAccounts = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const baseCurrency = normalizeCurrency(req.query.baseCurrency, 'UZS');
    const { rows } = await db.query(
      'SELECT id, name, type, currency, balance, created_at FROM accounts WHERE user_id = $1 ORDER BY created_at',
      [scopeUserId]
    );

    const totalByCurrency = {};
    rows.forEach((a) => {
      totalByCurrency[a.currency] = (totalByCurrency[a.currency] || 0) + parseFloat(a.balance);
    });

    const rates = await getRatesWithLiveFallback();
    const accounts = rows.map((a) => {
      const conversion = getRate(a.currency, baseCurrency, rates);
      const rate = conversion?.rate || 1;
      const baseBalance = parseFloat(a.balance) * rate;
      return {
        ...a,
        base_currency: baseCurrency,
        base_balance: baseBalance,
        base_rate: rate,
      };
    });

    const totalBaseBalance = accounts.reduce((sum, a) => sum + (Number.parseFloat(a.base_balance) || 0), 0);

    res.json({
      success: true,
      data: {
        accounts,
        totalByCurrency,
        totalBaseBalance,
        baseCurrency,
        count: rows.length,
      }
    });
  } catch (error) {
    next(error);
  }
};

const createAccount = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { name, type, currency, balance } = req.body;
    const normalizedBalance = balance === undefined ? 0 : Number.parseFloat(balance);
    if (!Number.isFinite(normalizedBalance) || normalizedBalance < 0) {
      return res.status(400).json({ success: false, error: 'Balans notogri' });
    }

    const { rows } = await db.query(
      'INSERT INTO accounts (user_id, name, type, currency, balance, initial_balance) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [scopeUserId, name.trim(), type, currency || 'UZS', normalizedBalance, normalizedBalance]
    );

    await logAudit({
      req,
      userId: req.user.id,
      action: 'ACCOUNT_CREATE',
      entity: 'account',
      entityId: rows[0].id,
      metadata: { type: rows[0].type, currency: rows[0].currency, balance: rows[0].balance },
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateAccount = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { name, type, currency } = req.body;
    const normalizedName = typeof name === 'string' ? name.trim() : undefined;

    const { rows } = await db.query(
      'UPDATE accounts SET name = COALESCE($1, name), type = COALESCE($2, type), currency = COALESCE($3, currency) WHERE id = $4 AND user_id = $5 RETURNING *',
      [normalizedName, type, currency, req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Hisob topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'ACCOUNT_UPDATE',
      entity: 'account',
      entityId: rows[0].id,
      metadata: { type: rows[0].type, currency: rows[0].currency, name: rows[0].name },
    });

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteAccount = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { rows } = await db.query(
      'DELETE FROM accounts WHERE id = $1 AND user_id = $2 RETURNING id, name',
      [req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Hisob topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'ACCOUNT_DELETE',
      entity: 'account',
      entityId: rows[0].id,
      metadata: { name: rows[0].name },
    });

    res.json({ success: true, message: rows[0].name + ' ochirildi' });
  } catch (error) {
    next(error);
  }
};

const reconcileAccounts = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const fix = req.query.fix === 'true';
    const result = await reconcileBalances(scopeUserId, { fix });

    await logAudit({
      req,
      userId: req.user.id,
      action: fix ? 'ACCOUNT_RECONCILE_FIX' : 'ACCOUNT_RECONCILE_CHECK',
      entity: 'account',
      metadata: {
        checked: result.checked,
        mismatches: result.mismatches.length,
        fixed: result.fixed,
      },
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAccounts, createAccount, updateAccount, deleteAccount, reconcileAccounts };
