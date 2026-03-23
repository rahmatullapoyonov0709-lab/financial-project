const db = require('../config/db');
const { logAudit } = require('../services/auditService');
const { buildQuote } = require('../services/fxService');
const { resolveScopeUserId } = require('../services/householdScopeService');

const MAX_LIMIT = 100;

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

const getTransferQuote = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { fromAccountId, toAccountId } = req.query;
    const amount = req.query.amount ? toAmount(req.query.amount) : 1;

    if (!fromAccountId || !toAccountId) {
      return res.status(400).json({ success: false, error: 'Hisoblar tanlanishi kerak' });
    }
    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, error: 'Summa notogri' });
    }
    if (fromAccountId === toAccountId) {
      return res.status(400).json({ success: false, error: 'Bir xil hisobga otkazma bolmaydi' });
    }

    const { rows } = await db.query(
      'SELECT id, name, currency, balance FROM accounts WHERE user_id = $1 AND id = ANY($2::uuid[])',
      [scopeUserId, [fromAccountId, toAccountId]]
    );

    const fromAccount = rows.find((row) => row.id === fromAccountId);
    const toAccount = rows.find((row) => row.id === toAccountId);

    if (!fromAccount || !toAccount) {
      return res.status(404).json({ success: false, error: 'Hisoblardan biri topilmadi' });
    }

    const quote = buildQuote({
      amount,
      fromCurrency: fromAccount.currency,
      toCurrency: toAccount.currency,
    });

    if (quote.error) {
      return res.status(400).json({ success: false, error: quote.error });
    }

    res.json({
      success: true,
      data: {
        ...quote,
        fromAccount: {
          id: fromAccount.id,
          name: fromAccount.name,
          currency: fromAccount.currency,
          balance: toAmount(fromAccount.balance) || 0,
        },
        toAccount: {
          id: toAccount.id,
          name: toAccount.name,
          currency: toAccount.currency,
          balance: toAmount(toAccount.balance) || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const getTransfers = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const page = parsePositiveInt(req.query.page, 1);
    const limit = Math.min(parsePositiveInt(req.query.limit, 20), MAX_LIMIT);
    const from = req.query.from ? normalizeDate(req.query.from) : null;
    const to = req.query.to ? normalizeDate(req.query.to) : null;
    const offset = (page - 1) * limit;

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

    if (from) { conds.push('t.date >= $' + idx); params.push(from); idx++; }
    if (to) { conds.push('t.date <= $' + idx); params.push(to); idx++; }

    const where = conds.join(' AND ');

    const countR = await db.query(
      'SELECT COUNT(*) as total FROM transfers t WHERE ' + where,
      params
    );

    params.push(limit);
    params.push(offset);

    const { rows } = await db.query(
      'SELECT t.*, fa.name AS from_account_name, fa.currency AS from_currency, ta.name AS to_account_name, ta.currency AS to_currency FROM transfers t JOIN accounts fa ON fa.id = t.from_account_id JOIN accounts ta ON ta.id = t.to_account_id WHERE ' + where + ' ORDER BY t.date DESC LIMIT $' + idx + ' OFFSET $' + (idx + 1),
      params
    );

    res.json({
      success: true,
      data: {
        transfers: rows,
        pagination: {
          page,
          limit,
          total: parseInt(countR.rows[0].total),
          totalPages: Math.ceil(parseInt(countR.rows[0].total) / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

const createTransfer = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { fromAccountId, toAccountId, fromAmount, date, note } = req.body;
    const normalizedFromAmount = toAmount(fromAmount);
    const normalizedDate = date ? normalizeDate(date) : null;

    if (fromAccountId === toAccountId) {
      return res.status(400).json({ success: false, error: 'Bir xil hisobga otkazma bolmaydi' });
    }
    if (!normalizedFromAmount || normalizedFromAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Summa notogri' });
    }
    if (date && !normalizedDate) {
      return res.status(400).json({ success: false, error: 'Sana notogri (YYYY-MM-DD)' });
    }

    const result = await db.transaction(async (client) => {
      const fromAcc = await client.query(
        'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [fromAccountId, scopeUserId]
      );

      if (!fromAcc.rows.length) {
        throw Object.assign(new Error('Jonatuvchi hisob topilmadi'), { statusCode: 404 });
      }

      const toAcc = await client.query(
        'SELECT * FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [toAccountId, scopeUserId]
      );

      if (!toAcc.rows.length) {
        throw Object.assign(new Error('Qabul qiluvchi hisob topilmadi'), { statusCode: 404 });
      }

      const quote = buildQuote({
        amount: normalizedFromAmount,
        fromCurrency: fromAcc.rows[0].currency,
        toCurrency: toAcc.rows[0].currency,
      });

      if (quote.error) {
        throw Object.assign(new Error(quote.error), { statusCode: 400 });
      }

      const fromAmountValue = quote.fromAmount;
      const toAmountValue = quote.toAmount;
      const normalizedExchangeRate = quote.exchangeRate;

      if (parseFloat(fromAcc.rows[0].balance) < fromAmountValue) {
        throw Object.assign(new Error('Yetarli mablag yoq'), { statusCode: 400 });
      }

      const fromAccUpdate = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
        [fromAmountValue, fromAccountId, scopeUserId]
      );
      if (fromAccUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Jonatuvchi hisob yangilanmadi'), { statusCode: 400 });
      }

      const toAccUpdate = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [toAmountValue, toAccountId, scopeUserId]
      );
      if (toAccUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Qabul qiluvchi hisob yangilanmadi'), { statusCode: 400 });
      }

      const trR = await client.query(
        'INSERT INTO transfers (user_id, from_account_id, to_account_id, from_amount, to_amount, exchange_rate, date, note) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [
          scopeUserId,
          fromAccountId,
          toAccountId,
          fromAmountValue,
          toAmountValue,
          normalizedExchangeRate,
          normalizedDate || new Date(),
          note ? String(note).trim() : null,
        ]
      );

      await logAudit({
        client,
        req,
        userId: req.user.id,
        action: 'TRANSFER_CREATE',
        entity: 'transfer',
        entityId: trR.rows[0].id,
        metadata: {
          fromAccountId,
          toAccountId,
          fromAmount: fromAmountValue,
          toAmount: toAmountValue,
          exchangeRate: normalizedExchangeRate,
        },
      });

      return trR.rows[0];
    });

    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

const deleteTransfer = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    await db.transaction(async (client) => {
      const trR = await client.query(
        'SELECT * FROM transfers WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [req.params.id, scopeUserId]
      );

      if (!trR.rows.length) {
        throw Object.assign(new Error('Topilmadi'), { statusCode: 404 });
      }

      const tr = trR.rows[0];

      const toAcc = await client.query(
        'SELECT balance FROM accounts WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [tr.to_account_id, scopeUserId]
      );
      if (!toAcc.rows.length) {
        throw Object.assign(new Error('Qabul qiluvchi hisob topilmadi'), { statusCode: 404 });
      }
      if (parseFloat(toAcc.rows[0].balance) < parseFloat(tr.to_amount)) {
        throw Object.assign(new Error('Otkazmani bekor qilish uchun qabul qiluvchi hisobda mablag yetarli emas'), { statusCode: 400 });
      }

      const fromAccUpdate = await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2 AND user_id = $3',
        [tr.from_amount, tr.from_account_id, scopeUserId]
      );
      if (fromAccUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Jonatuvchi hisob yangilanmadi'), { statusCode: 400 });
      }

      const toAccUpdate = await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND user_id = $3',
        [tr.to_amount, tr.to_account_id, scopeUserId]
      );
      if (toAccUpdate.rowCount !== 1) {
        throw Object.assign(new Error('Qabul qiluvchi hisob yangilanmadi'), { statusCode: 400 });
      }

      await client.query('DELETE FROM transfers WHERE id = $1 AND user_id = $2', [req.params.id, scopeUserId]);

      await logAudit({
        client,
        req,
        userId: req.user.id,
        action: 'TRANSFER_DELETE',
        entity: 'transfer',
        entityId: tr.id,
        metadata: {
          fromAccountId: tr.from_account_id,
          toAccountId: tr.to_account_id,
          fromAmount: tr.from_amount,
          toAmount: tr.to_amount,
        },
      });
    });

    res.json({ success: true, message: 'Otkazma bekor qilindi' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getTransfers, getTransferQuote, createTransfer, deleteTransfer };
