const db = require('../config/db');
const { resolveScopeUserId } = require('./householdScopeService');

const budgetCheckTimestamps = new Map();
const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Tashkent';

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const getMonthYearInTimeZone = (date, timeZone) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    parts.forEach((part) => {
      map[part.type] = part.value;
    });
    return {
      month: Number.parseInt(map.month, 10),
      year: Number.parseInt(map.year, 10),
    };
  } catch {
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
    };
  }
};

const getLanguage = async (userId) => {
  const { rows } = await db.query(
    'SELECT language FROM user_ai_settings WHERE user_id = $1 LIMIT 1',
    [userId]
  );
  return rows[0]?.language || 'uz';
};

const buildBudgetAlertContent = ({ language, categoryName, percent, spent, limit, stage }) => {
  const percentLabel = Math.round(percent);
  const spentLabel = Math.round(spent).toLocaleString('en-US');
  const limitLabel = Math.round(limit).toLocaleString('en-US');

  if (language === 'en') {
    if (stage === 'limit') {
      return {
        title: 'Budget limit exceeded',
        message: `${categoryName} budget exceeded the limit. ${spentLabel} / ${limitLabel} UZS spent.`,
      };
    }
    if (stage === 'danger') {
      return {
        title: 'Budget almost reached',
        message: `${categoryName} budget reached ${percentLabel}% of the limit. ${spentLabel} / ${limitLabel} UZS spent.`,
      };
    }
    return {
      title: 'Budget warning',
      message: `${categoryName} budget reached ${percentLabel}% of the limit. ${spentLabel} / ${limitLabel} UZS spent.`,
    };
  }

  if (language === 'ru') {
    if (stage === 'limit') {
      return {
        title: 'Лимит бюджета превышен',
        message: `Бюджет категории ${categoryName} превышен. Потрачено ${spentLabel} / ${limitLabel} UZS.`,
      };
    }
    if (stage === 'danger') {
      return {
        title: 'Бюджет почти исчерпан',
        message: `Бюджет категории ${categoryName} достиг ${percentLabel}% лимита. Потрачено ${spentLabel} / ${limitLabel} UZS.`,
      };
    }
    return {
      title: 'Предупреждение по бюджету',
      message: `Бюджет категории ${categoryName} достиг ${percentLabel}% лимита. Потрачено ${spentLabel} / ${limitLabel} UZS.`,
    };
  }

  if (stage === 'limit') {
    return {
      title: 'Byudjet limiti oshib ketdi',
      message: `${categoryName} byudjeti limitdan oshib ketdi. ${spentLabel} / ${limitLabel} UZS sarflandi.`,
    };
  }
  if (stage === 'danger') {
    return {
      title: 'Byudjet limitiga juda yaqinlashdingiz',
      message: `${categoryName} byudjeti limitning ${percentLabel}% qismiga yetdi. ${spentLabel} / ${limitLabel} UZS sarflandi.`,
    };
  }
  return {
    title: 'Byudjet ogohlantirishi',
    message: `${categoryName} byudjeti limitning ${percentLabel}% qismiga yetdi. ${spentLabel} / ${limitLabel} UZS sarflandi.`,
  };
};

const resolveStage = (percent) => {
  if (percent >= 100) return 'limit';
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warn';
  return null;
};

const ensureBudgetNotificationsForUser = async (userId, now = new Date()) => {
  const scopeUserId = await resolveScopeUserId(userId);
  const lastCheckedAt = budgetCheckTimestamps.get(scopeUserId) || 0;
  if (Date.now() - lastCheckedAt < 5000) {
    return { created: 0, reason: 'throttled' };
  }
  budgetCheckTimestamps.set(scopeUserId, Date.now());

  const { month, year } = getMonthYearInTimeZone(now, DEFAULT_TIMEZONE);
  const language = await getLanguage(scopeUserId);

  const { rows } = await db.query(
    `SELECT b.id, b.limit_amount, c.name AS category_name,
            COALESCE(s.total, 0) AS spent_amount,
            CASE WHEN b.limit_amount > 0
              THEN ROUND((COALESCE(s.total, 0) / b.limit_amount) * 100, 1)
              ELSE 0
            END AS usage_percent
     FROM budgets b
     LEFT JOIN categories c ON c.id = b.category_id
     LEFT JOIN LATERAL (
       SELECT SUM(t.amount) AS total
       FROM transactions t
       WHERE t.user_id = b.user_id
         AND t.category_id = b.category_id
         AND t.type = 'EXPENSE'
         AND EXTRACT(MONTH FROM t.date) = b.month
         AND EXTRACT(YEAR FROM t.date) = b.year
     ) s ON TRUE
     WHERE b.user_id = $1
       AND b.month = $2
       AND b.year = $3`,
    [scopeUserId, month, year]
  );

  let created = 0;

  for (const row of rows) {
    const percent = toNumber(row.usage_percent);
    const stage = resolveStage(percent);
    if (!stage) {
      continue;
    }

    const { title, message } = buildBudgetAlertContent({
      language,
      categoryName: row.category_name || 'Unknown',
      percent,
      spent: toNumber(row.spent_amount),
      limit: toNumber(row.limit_amount),
      stage,
    });

    const periodKey = `b:${String(row.id || '').slice(0, 8)}:${year}${String(month).padStart(2, '0')}:${stage}`;

    const result = await db.query(
      `INSERT INTO user_notifications (user_id, type, title, message, payload, period_key)
       VALUES ($1, 'BUDGET_ALERT', $2, $3, $4::jsonb, $5)
       ON CONFLICT DO NOTHING
       RETURNING id`,
      [
        scopeUserId,
        title,
        message,
        JSON.stringify({
          budgetId: row.id,
          month,
          year,
          stage,
          usagePercent: percent,
        }),
        periodKey,
      ]
    );

    if (result.rows.length > 0) {
      created += 1;
    }
  }

  return { created, reason: created > 0 ? 'created' : 'no_changes' };
};

module.exports = {
  ensureBudgetNotificationsForUser,
};
