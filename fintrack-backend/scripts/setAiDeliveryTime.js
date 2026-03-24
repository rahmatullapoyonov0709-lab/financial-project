require('dotenv').config();

const db = require('../src/config/db');
const { resolveScopeUserId } = require('../src/services/householdScopeService');

const VALID_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const main = async () => {
  const deliveryTime = process.argv[2] || '21:00';
  if (!VALID_TIME_RE.test(deliveryTime)) {
    throw new Error('Invalid time format. Use HH:MM (24h), e.g. 21:00');
  }

  const userRes = await db.query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
  if (!userRes.rowCount) throw new Error('No users found');

  const scopeUserId = await resolveScopeUserId(userRes.rows[0].id);
  await db.query('UPDATE user_ai_settings SET delivery_time = $1, updated_at = NOW() WHERE user_id = $2', [deliveryTime, scopeUserId]);
  const settings = await db.query(
    'SELECT user_id, enabled, report_period, delivery_time, timezone, language, last_sent_period_key FROM user_ai_settings WHERE user_id = $1',
    [scopeUserId]
  );

  console.log(JSON.stringify({ ok: true, scopeUserId, settings: settings.rows[0] || null }, null, 2));
};

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end().catch(() => {});
  });
