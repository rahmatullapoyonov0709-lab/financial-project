require('dotenv').config();

const db = require('../src/config/db');

const main = async () => {
  const users = await db.query('SELECT id, email, created_at FROM users ORDER BY created_at ASC LIMIT 5');
  const settings = await db.query(
    `SELECT user_id, enabled, report_period, delivery_time, timezone, language, model, last_sent_period_key, updated_at
     FROM user_ai_settings
     ORDER BY updated_at DESC
     LIMIT 10`
  );
  const lastAiNotifs = await db.query(
    `SELECT id, user_id, type, title, created_at, period_key
     FROM user_notifications
     WHERE type = 'AI_REPORT'
     ORDER BY created_at DESC
     LIMIT 10`
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        nowLocal: new Date().toString(),
        nowUtc: new Date().toISOString(),
        env: {
          AI_REPORT_SCHEDULER: process.env.AI_REPORT_SCHEDULER,
          AI_REPORT_SCHEDULER_MODE: process.env.AI_REPORT_SCHEDULER_MODE,
          AI_REPORT_SCHEDULER_INTERVAL_MS: process.env.AI_REPORT_SCHEDULER_INTERVAL_MS,
          NODE_ENV: process.env.NODE_ENV,
          OPENROUTER_API_KEY: Boolean(process.env.OPENROUTER_API_KEY),
        },
        users: users.rows,
        settings: settings.rows,
        lastAiNotifs: lastAiNotifs.rows,
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

