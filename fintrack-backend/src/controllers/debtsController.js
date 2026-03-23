const db = require('../config/db');
const { logAudit } = require('../services/auditService');
const { resolveScopeUserId } = require('../services/householdScopeService');

const getDebts = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { type, status } = req.query;
    const params = [scopeUserId];
    const conds = ['user_id = $1'];
    let idx = 2;

    if (type) { conds.push('type = $' + idx); params.push(type); idx++; }
    if (status) { conds.push('status = $' + idx); params.push(status); idx++; }

    const { rows } = await db.query(
      'SELECT * FROM debts WHERE ' + conds.join(' AND ') + ' ORDER BY CASE WHEN status = \'OPEN\' THEN 0 ELSE 1 END, due_date ASC NULLS LAST, created_at DESC',
      params
    );

    const summary = { totalLent: 0, totalBorrowed: 0, openCount: 0 };
    rows.forEach((d) => {
      if (d.status === 'OPEN') {
        summary.openCount++;
        if (d.type === 'LENT') summary.totalLent += parseFloat(d.amount);
        if (d.type === 'BORROWED') summary.totalBorrowed += parseFloat(d.amount);
      }
    });

    res.json({ success: true, data: { debts: rows, summary, count: rows.length } });
  } catch (error) {
    next(error);
  }
};

const createDebt = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { personName, type, amount, currency, description, dueDate } = req.body;
    const normalizedAmount = Number.parseFloat(amount);
    if (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0) {
      return res.status(400).json({ success: false, error: 'Summa notogri' });
    }

    const { rows } = await db.query(
      'INSERT INTO debts (user_id, person_name, type, amount, currency, description, due_date) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [scopeUserId, personName.trim(), type, normalizedAmount, currency || 'UZS', description, dueDate]
    );

    await logAudit({
      req,
      userId: req.user.id,
      action: 'DEBT_CREATE',
      entity: 'debt',
      entityId: rows[0].id,
      metadata: { type, amount: normalizedAmount, currency: currency || 'UZS' },
    });

    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const updateDebt = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { personName, amount, description, dueDate, status } = req.body;
    const normalizedAmount = amount === undefined ? undefined : Number.parseFloat(amount);
    if (amount !== undefined && (!Number.isFinite(normalizedAmount) || normalizedAmount <= 0)) {
      return res.status(400).json({ success: false, error: 'Summa notogri' });
    }

    const { rows } = await db.query(
      'UPDATE debts SET person_name = COALESCE($1, person_name), amount = COALESCE($2, amount), description = COALESCE($3, description), due_date = COALESCE($4, due_date), status = COALESCE($5, status) WHERE id = $6 AND user_id = $7 RETURNING *',
      [personName, normalizedAmount, description, dueDate, status, req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'DEBT_UPDATE',
      entity: 'debt',
      entityId: rows[0].id,
      metadata: { status: rows[0].status, amount: rows[0].amount },
    });

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const deleteDebt = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { rows } = await db.query(
      'DELETE FROM debts WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Topilmadi' });
    }

    await logAudit({
      req,
      userId: req.user.id,
      action: 'DEBT_DELETE',
      entity: 'debt',
      entityId: req.params.id,
    });

    res.json({ success: true, message: 'Qarz ochirildi' });
  } catch (error) {
    next(error);
  }
};

module.exports = { getDebts, createDebt, updateDebt, deleteDebt };
