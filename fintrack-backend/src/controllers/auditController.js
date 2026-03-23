const db = require('../config/db');

const getMyAuditLogs = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '50', 10), 1), 200);
    const { rows } = await db.query(
      `SELECT id, action, entity, entity_id, metadata, ip_address, user_agent, created_at
       FROM audit_logs
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [req.user.id, limit]
    );

    res.json({
      success: true,
      data: {
        logs: rows,
        count: rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getMyAuditLogs };
