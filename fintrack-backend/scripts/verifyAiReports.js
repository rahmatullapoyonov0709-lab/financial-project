require('dotenv').config();

const db = require('../src/config/db');
const { ensureDueAiReportForUser, getOrCreateAiSettings } = require('../src/services/aiReportService');
const { resolveScopeUserId } = require('../src/services/householdScopeService');

const main = async () => {
  const userRes = await db.query('SELECT id FROM users ORDER BY created_at ASC LIMIT 1');
  if (userRes.rowCount === 0) {
    throw new Error('No users found in database');
  }

  const userId = userRes.rows[0].id;
  const scopeUserId = await resolveScopeUserId(userId);
  await getOrCreateAiSettings(scopeUserId);

  const timeZone = 'Asia/Tashkent';
  const originalSettingsRes = await db.query(
    `SELECT enabled, report_period, delivery_time, timezone, language, model, last_sent_period_key
     FROM user_ai_settings
     WHERE user_id = $1`,
    [scopeUserId]
  );
  const originalSettings = originalSettingsRes.rows[0];

  let notDue;
  let due;
  try {
    await db.query(
      `UPDATE user_ai_settings
       SET enabled = TRUE,
           report_period = 'daily',
           timezone = $2,
           language = 'uz',
           delivery_time = '23:59',
           last_sent_period_key = NULL
       WHERE user_id = $1`,
      [scopeUserId, timeZone]
    );

    notDue = await ensureDueAiReportForUser(scopeUserId, new Date());

    await new Promise((resolve) => setTimeout(resolve, 5200));

    await db.query(
      `UPDATE user_ai_settings
       SET delivery_time = $1,
           last_sent_period_key = NULL
       WHERE user_id = $2`,
      ['00:00', scopeUserId]
    );

    due = await ensureDueAiReportForUser(scopeUserId, new Date());
  } finally {
    await db.query(
      `UPDATE user_ai_settings
       SET enabled = $2,
           report_period = $3,
           delivery_time = $4,
           timezone = $5,
           language = $6,
           model = $7,
           last_sent_period_key = $8,
           updated_at = NOW()
       WHERE user_id = $1`,
      [
        scopeUserId,
        originalSettings.enabled,
        originalSettings.report_period,
        originalSettings.delivery_time,
        originalSettings.timezone,
        originalSettings.language,
        originalSettings.model,
        originalSettings.last_sent_period_key,
      ]
    );
  }

  const notificationRes = await db.query(
    `SELECT id, type, title, LEFT(message, 140) AS message_preview, created_at
     FROM user_notifications
     WHERE user_id = $1 AND type = 'AI_REPORT'
     ORDER BY created_at DESC
     LIMIT 1`,
    [scopeUserId]
  );

  const settingsRes = await db.query(
    `SELECT enabled, report_period, delivery_time, timezone, language, last_sent_period_key, updated_at
     FROM user_ai_settings
     WHERE user_id = $1`,
    [scopeUserId]
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        userId,
        scopeUserId,
        checkNotDueResult: notDue,
        checkDueResult: due,
        latestAiNotification: notificationRes.rows[0] || null,
        currentAiSettings: settingsRes.rows[0] || null,
      },
      null,
      2
    )
  );
};

main()
  .catch((error) => {
    console.error(JSON.stringify({ ok: false, error: error.message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.pool.end().catch(() => {});
  });
