const db = require('../config/db');
const { logAudit } = require('../services/auditService');
const { resolveScopeUserId } = require('../services/householdScopeService');

const MAX_LIMIT = 100;
const VALID_TYPES = new Set(['INCOME', 'EXPENSE']);

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

const toAmount = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getTransactions = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), MAX_LIMIT);
    const offset = (page - 1) * limit;
    const { type, accountId, categoryId } = req.query;
    const from = req.query.from ? normalizeDate(req.query.from) : null;
    const to = req.query.to ? normalizeDate(req.query.to) : null;

    if (type && !VALID_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: 'type notogri' });
    }
    if (req.query.from && !from) {
      return res.status(400).json({ success: false, error: 'from sanasi notogri (YYYY-MM-DD)' });
    }
    if (req.query.to && !to) {
      return res.status(400).json({ success: false, error: 'to sanasi notogri (YYYY-MM-DD)' });
    }
    if (from && to && from > to) {
      return res.status(400).json({ success: false, error: 'from sanasi to dan katta bolmasligi kerak' });
    }

    const params = [scopeUserId];
    const conds = ['t.user_id = $1'];
    let idx = 2;

    if (type) { conds.push('t.type = $' + idx); params.push(type); idx++; }
    if (accountId) { conds.push('t.account_id = $' + idx); params.push(accountId); idx++; }
    if (categoryId) { conds.push('t.category_id = $' + idx); params.push(categoryId); idx++; }
    if (from) { conds.push('t.date >= $' + idx); params.push(from); idx++; }
    if (to) { conds.push('t.date <= $' + idx); params.push(to); idx++; }

    const where = conds.join(' AND ');

    const countR = await db.query(
      'SELECT COUNT(*) as total FROM transactions t WHERE ' + where,
      params
    );
    const total = parseInt(countR.rows[0].total);

    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      'SELECT t.id, t.type, t.amount, t.description, t.date, t.created_at, t.account_id, a.name AS account_name, a.currency AS account_currency, t.category_id, c.name AS category_name, c.icon AS category_icon, c.color AS category_color FROM transactions t JOIN accounts a ON a.id = t.account_id JOIN categories c ON c.id = t.category_id WHERE ' + where + ' ORDER BY t.date DESC, t.created_at DESC LIMIT $' + idx + ' OFFSET $' + (idx + 1),
      params
    );

    res.json({
      success: true,
      data: {
        transactions: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const createTransaction = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { type, amount, accountId, categoryId, description, date } = req.body;
    const normalizedAmount = toAmount(amount);
    const normalizedDate = date ? normalizeDate(date) : null;

    if (!VALID_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: 'Turi notogri' });
    }
    if (!normalizedAmount || normalizedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Summa notogri' });
    }
    if (date && !normalizedDate) {
      return res.status(400).json({ success: false, error: 'Sana notogri (YYYY-MM-DD)' });
    }

    const result = await db.transaction(async (client) => {
      const accR = await client.query(
        'SELECT id, balance, currency, name FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [accountId, scopeUserId]
      );

      if (!accR.rows.length) {
        throw Object.assign(new Error('Hisob topilmadi'), { statusCode: 404 });
      }

      const currentBalance = toAmount(accR.rows[0].balance) || 0;
      if (type === 'EXPENSE' && currentBalance < normalizedAmount) {
        throw Object.assign(new Error('Hisobda mablag yetarli emas'), { statusCode: 400 });
      }

      const catR = await client.query(
        'SELECT id FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2) AND type = $3',
        [categoryId, scopeUserId, type]
      );
      if (!catR.rows.length) {
        throw Object.assign(new Error('Kategoriya topilmadi yoki turi mos emas'), { statusCode: 400 });
      }

      const txR = await client.query(
        'INSERT INTO transactions (user_id, account_id, category_id, type, amount, description, date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [
          scopeUserId,
          accountId,
          categoryId,
          type,
          normalizedAmount,
          description ? String(description).trim() : null,
          normalizedDate || new Date(),
        ]
      );

      const change = type === 'INCOME' ? normalizedAmount : -normalizedAmount;
      const accUpdate = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [change, accountId, scopeUserId]
      );
      if (accUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Hisob yangilanmadi'), { statusCode: 400 });
      }

      const updAcc = await client.query('SELECT balance FROM accounts WHERE id = $1 AND user_id = $2', [accountId, scopeUserId]);

      await logAudit({
        client,
        req,
        userId: req.user.id,
        action: 'TRANSACTION_CREATE',
        entity: 'transaction',
        entityId: txR.rows[0].id,
        metadata: {
          type,
          amount: normalizedAmount,
          accountId,
          categoryId,
        },
      });

      return { transaction: txR.rows[0], newBalance: updAcc.rows[0].balance };
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const updateTransaction = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { type, amount, accountId, categoryId, description, date } = req.body;
    const hasAmount = Object.prototype.hasOwnProperty.call(req.body, 'amount');
    const hasDate = Object.prototype.hasOwnProperty.call(req.body, 'date');
    const hasDescription = Object.prototype.hasOwnProperty.call(req.body, 'description');
    const normalizedAmount = hasAmount ? toAmount(amount) : null;
    const normalizedDate = hasDate ? normalizeDate(date) : null;

    if (type && !VALID_TYPES.has(type)) {
      return res.status(400).json({ success: false, error: 'Turi notogri' });
    }
    if (hasAmount && (!normalizedAmount || normalizedAmount <= 0)) {
      return res.status(400).json({ success: false, error: 'Summa notogri' });
    }
    if (hasDate && !normalizedDate) {
      return res.status(400).json({ success: false, error: 'Sana notogri (YYYY-MM-DD)' });
    }

    const result = await db.transaction(async (client) => {
      const oldR = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [req.params.id, scopeUserId]
      );

      if (!oldR.rows.length) {
        throw Object.assign(new Error('Topilmadi'), { statusCode: 404 });
      }

      const old = oldR.rows[0];
      const newType = type || old.type;
      const newAmount = hasAmount ? normalizedAmount : parseFloat(old.amount);
      const newAccId = accountId || old.account_id;
      const newCatId = categoryId || old.category_id;
      const newDate = hasDate ? normalizedDate : old.date;
      const newDescription = hasDescription
        ? (description ? String(description).trim() : null)
        : old.description;

      const accountIds = newAccId === old.account_id ? [old.account_id] : [old.account_id, newAccId];
      const accR = await client.query(
        'SELECT id, balance FROM accounts WHERE user_id = $1 AND id = ANY($2::uuid[]) ORDER BY id FOR UPDATE',
        [scopeUserId, accountIds]
      );
      if (accR.rows.length !== accountIds.length) {
        throw Object.assign(new Error('Hisob topilmadi'), { statusCode: 404 });
      }

      const balanceMap = new Map(
        accR.rows.map((row) => [row.id, toAmount(row.balance) || 0])
      );

      const catR = await client.query(
        'SELECT id FROM categories WHERE id = $1 AND (user_id IS NULL OR user_id = $2) AND type = $3',
        [newCatId, scopeUserId, newType]
      );
      if (!catR.rows.length) {
        throw Object.assign(new Error('Kategoriya topilmadi yoki turi mos emas'), { statusCode: 400 });
      }

      const oldRev = old.type === 'INCOME' ? -parseFloat(old.amount) : parseFloat(old.amount);
      const oldAccountBalanceAfterRevert = (balanceMap.get(old.account_id) || 0) + oldRev;
      balanceMap.set(old.account_id, oldAccountBalanceAfterRevert);

      const oldAccUpdate = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [oldRev, old.account_id, scopeUserId]
      );
      if (oldAccUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Hisob yangilanmadi'), { statusCode: 400 });
      }

      const upR = await client.query(
        'UPDATE transactions SET type = $1, amount = $2, account_id = $3, category_id = $4, description = $5, date = $6 WHERE id = $7 AND user_id = $8 RETURNING *',
        [newType, newAmount, newAccId, newCatId, newDescription, newDate, req.params.id, scopeUserId]
      );

      const newChange = newType === 'INCOME' ? newAmount : -newAmount;
      const newAccountBalanceAfterChange = (balanceMap.get(newAccId) || 0) + newChange;
      if (newAccountBalanceAfterChange < 0) {
        throw Object.assign(new Error('Hisobda mablag yetarli emas'), { statusCode: 400 });
      }

      const newAccUpdate = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [newChange, newAccId, scopeUserId]
      );
      if (newAccUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Hisob yangilanmadi'), { statusCode: 400 });
      }

      await logAudit({
        client,
        req,
        userId: req.user.id,
        action: 'TRANSACTION_UPDATE',
        entity: 'transaction',
        entityId: upR.rows[0].id,
        metadata: {
          oldType: old.type,
          newType,
          oldAmount: old.amount,
          newAmount,
          oldAccountId: old.account_id,
          newAccountId: newAccId,
        },
      });

      return { transaction: upR.rows[0] };
    });

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const deleteTransaction = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    await db.transaction(async (client) => {
      const txR = await client.query(
        'SELECT * FROM transactions WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [req.params.id, scopeUserId]
      );

      if (!txR.rows.length) {
        throw Object.assign(new Error('Topilmadi'), { statusCode: 404 });
      }

      const tx = txR.rows[0];
      const rev = tx.type === 'INCOME' ? -parseFloat(tx.amount) : parseFloat(tx.amount);

      const accUpdate = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [rev, tx.account_id, scopeUserId]
      );
      if (accUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Hisob yangilanmadi'), { statusCode: 400 });
      }

      await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, scopeUserId]);

      await logAudit({
        client,
        req,
        userId: req.user.id,
        action: 'TRANSACTION_DELETE',
        entity: 'transaction',
        entityId: tx.id,
        metadata: {
          type: tx.type,
          amount: tx.amount,
          accountId: tx.account_id,
        },
      });
    });

    res.json({ success: true, message: 'Tranzaksiya ochirildi' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTransactions, createTransaction, updateTransaction, deleteTransaction };
