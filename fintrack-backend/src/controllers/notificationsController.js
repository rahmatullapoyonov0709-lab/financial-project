const db = require('../config/db');
const { resolveScopeUserId } = require('../services/householdScopeService');
const { ensureDueAiReportForUser } = require('../services/aiReportService');
const { ensureBudgetNotificationsForUser } = require('../services/budgetNotificationService');

const toPositiveInt = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
};

const listNotifications = async (req, res, next) => {
  try {
    await ensureDueAiReportForUser(req.user.id);
    await ensureBudgetNotificationsForUser(req.user.id);
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const limit = toPositiveInt(req.query.limit, 30, 100);
    const page = toPositiveInt(req.query.page, 1, 10000);
    const offset = (page - 1) * limit;
    const unreadOnly = String(req.query.unreadOnly || '').toLowerCase() === 'true';

    const params = [scopeUserId];
    const conds = ['user_id = $1'];
    let idx = 2;

    if (unreadOnly) {
      conds.push('is_read = FALSE');
    }

    params.push(limit);
    params.push(offset);

    const where = conds.join(' AND ');
    const { rows } = await db.query(
      `SELECT id, type, title, message, payload, period_key, is_read, created_at, read_at
       FROM user_notifications
       WHERE ${where}
       ORDER BY created_at DESC
       LIMIT $${idx} OFFSET $${idx + 1}`,
      params
    );

    const [{ count: totalCountRaw }] = (await db.query(
      `SELECT COUNT(*) AS count
       FROM user_notifications
       WHERE ${where}`,
      params.slice(0, 1)
    )).rows;

    const [{ count: unreadCountRaw }] = (await db.query(
      `SELECT COUNT(*) AS count
       FROM user_notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [scopeUserId]
    )).rows;

    res.json({
      success: true,
      data: {
        items: rows,
        unreadCount: Number.parseInt(unreadCountRaw, 10) || 0,
        pagination: {
          page,
          limit,
          total: Number.parseInt(totalCountRaw, 10) || 0,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

const markNotificationRead = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { rows } = await db.query(
      `UPDATE user_notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE id = $1 AND user_id = $2
       RETURNING id, is_read, read_at`,
      [req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Xabar topilmadi' });
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

const markAllNotificationsRead = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { rowCount } = await db.query(
      `UPDATE user_notifications
       SET is_read = TRUE, read_at = NOW()
       WHERE user_id = $1 AND is_read = FALSE`,
      [scopeUserId]
    );

    res.json({
      success: true,
      data: { updated: rowCount || 0 },
    });
  } catch (error) {
    next(error);
  }
};

const deleteNotification = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { rows } = await db.query(
      `DELETE FROM user_notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [req.params.id, scopeUserId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Xabar topilmadi' });
    }

    res.json({ success: true, data: { id: rows[0].id } });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  deleteNotification,
};
