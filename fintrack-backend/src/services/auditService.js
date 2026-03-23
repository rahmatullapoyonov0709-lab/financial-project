const db = require('../config/db');
const { logger } = require('../utils/logger');

const extractRequestMeta = (req) => ({
  ipAddress: req?.ip || null,
  userAgent: req?.headers?.['user-agent'] || null,
  requestId: req?.requestId || null,
});

const logAudit = async ({
  client,
  req,
  userId,
  action,
  entity,
  entityId = null,
  metadata = {},
}) => {
  try {
    const runner = client || db;
    const meta = extractRequestMeta(req);

    await runner.query(
      `INSERT INTO audit_logs (user_id, action, entity, entity_id, metadata, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)`,
      [
        userId || null,
        action,
        entity,
        entityId || null,
        JSON.stringify({ ...metadata, requestId: meta.requestId }),
        meta.ipAddress,
        meta.userAgent,
      ]
    );
  } catch (error) {
    logger.warn('audit.write_failed', {
      action,
      entity,
      error: error.message,
    });
  }
};

module.exports = { logAudit };
