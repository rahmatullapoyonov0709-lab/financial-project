const db = require('../config/db');
const { logger } = require('../utils/logger');
const { resolveScopeUserId } = require('./householdScopeService');

const VALID_PERIODS = new Set(['daily', 'weekly', 'monthly', 'yearly']);
const VALID_LANGUAGES = new Set(['uz', 'en', 'ru']);
const DEFAULT_TIMEZONE = 'Asia/Tashkent';
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const dueCheckTimestamps = new Map();

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseClockToMinutes = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) return null;
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
};

const isDeliveryDue = (nowClock, deliveryTime) => {
  const nowMinutes = parseClockToMinutes(nowClock);
  const targetMinutes = parseClockToMinutes(deliveryTime);
  if (nowMinutes === null || targetMinutes === null) return false;
  return nowMinutes >= targetMinutes;
};

const toYmdFromUtcDate = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseYmdToUtcDate = (ymd) => {
  const [year, month, day] = String(ymd).split('-').map((chunk) => Number.parseInt(chunk, 10));
  return new Date(Date.UTC(year, month - 1, day));
};

const addUtcDays = (date, days) => {
  const copy = new Date(date.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
};

const getTimePartsInTimeZone = (date, timeZone) => {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const map = {};
    for (const part of parts) {
      map[part.type] = part.value;
    }
    return {
      year: Number.parseInt(map.year, 10),
      month: Number.parseInt(map.month, 10),
      day: Number.parseInt(map.day, 10),
      hour: map.hour,
      minute: map.minute,
    };
  } catch {
    return {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: String(date.getUTCHours()).padStart(2, '0'),
      minute: String(date.getUTCMinutes()).padStart(2, '0'),
    };
  }
};

const getWeekRange = (ymd) => {
  const today = parseYmdToUtcDate(ymd);
  const dayOfWeek = (today.getUTCDay() + 6) % 7;
  const start = addUtcDays(today, -dayOfWeek);
  const end = addUtcDays(start, 6);
  return {
    from: toYmdFromUtcDate(start),
    to: toYmdFromUtcDate(end),
    start,
    end,
  };
};

const getMonthRange = (year, month) => {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 0));
  return {
    from: toYmdFromUtcDate(start),
    to: toYmdFromUtcDate(end),
    start,
    end,
  };
};

const getYearRange = (year) => ({
  from: `${year}-01-01`,
  to: `${year}-12-31`,
});

const getPeriodMeta = (period, now, timeZone) => {
  const safePeriod = VALID_PERIODS.has(period) ? period : 'daily';
  const safeTimeZone = timeZone || DEFAULT_TIMEZONE;
  const parts = getTimePartsInTimeZone(now, safeTimeZone);
  const currentYmd = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;

  if (safePeriod === 'daily') {
    const currentDate = parseYmdToUtcDate(currentYmd);
    const previousDate = addUtcDays(currentDate, -1);
    return {
      period: safePeriod,
      key: `daily:${currentYmd}`,
      current: { from: currentYmd, to: currentYmd },
      previous: { from: toYmdFromUtcDate(previousDate), to: toYmdFromUtcDate(previousDate) },
      labelCurrent: currentYmd,
      labelPrevious: toYmdFromUtcDate(previousDate),
      clock: `${parts.hour}:${parts.minute}`,
    };
  }

  if (safePeriod === 'weekly') {
    const current = getWeekRange(currentYmd);
    const previousWeekEnd = addUtcDays(current.start, -1);
    const previous = getWeekRange(toYmdFromUtcDate(previousWeekEnd));
    return {
      period: safePeriod,
      key: `weekly:${current.from}`,
      current: { from: current.from, to: current.to },
      previous: { from: previous.from, to: previous.to },
      labelCurrent: `${current.from} - ${current.to}`,
      labelPrevious: `${previous.from} - ${previous.to}`,
      clock: `${parts.hour}:${parts.minute}`,
    };
  }

  if (safePeriod === 'monthly') {
    const current = getMonthRange(parts.year, parts.month);
    const prevYear = parts.month === 1 ? parts.year - 1 : parts.year;
    const prevMonth = parts.month === 1 ? 12 : parts.month - 1;
    const previous = getMonthRange(prevYear, prevMonth);
    return {
      period: safePeriod,
      key: `monthly:${parts.year}-${String(parts.month).padStart(2, '0')}`,
      current: { from: current.from, to: current.to },
      previous: { from: previous.from, to: previous.to },
      labelCurrent: `${parts.year}-${String(parts.month).padStart(2, '0')}`,
      labelPrevious: `${prevYear}-${String(prevMonth).padStart(2, '0')}`,
      clock: `${parts.hour}:${parts.minute}`,
    };
  }

  const currentYear = parts.year;
  const previousYear = currentYear - 1;
  return {
    period: 'yearly',
    key: `yearly:${currentYear}`,
    current: getYearRange(currentYear),
    previous: getYearRange(previousYear),
    labelCurrent: String(currentYear),
    labelPrevious: String(previousYear),
    clock: `${parts.hour}:${parts.minute}`,
  };
};

const getSummaryByRange = async (userId, range) => {
  const { rows } = await db.query(
    `SELECT
      COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE 0 END), 0) AS total_income,
      COALESCE(SUM(CASE WHEN type = 'EXPENSE' THEN amount ELSE 0 END), 0) AS total_expense
     FROM transactions
     WHERE user_id = $1 AND date >= $2 AND date <= $3`,
    [userId, range.from, range.to]
  );

  const totalIncome = toNumber(rows[0]?.total_income);
  const totalExpense = toNumber(rows[0]?.total_expense);
  return {
    totalIncome,
    totalExpense,
    net: totalIncome - totalExpense,
  };
};

const getCategoriesByRange = async (userId, range, type) => {
  const { rows } = await db.query(
    `SELECT c.name, COALESCE(SUM(t.amount), 0) AS total
     FROM transactions t
     JOIN categories c ON c.id = t.category_id
     WHERE t.user_id = $1
       AND t.date >= $2
       AND t.date <= $3
       AND t.type = $4
     GROUP BY c.name
     ORDER BY total DESC
     LIMIT 5`,
    [userId, range.from, range.to, type]
  );

  return rows.map((row) => ({
    name: row.name || 'Unknown',
    total: toNumber(row.total),
  }));
};

const calcChange = (current, previous) => {
  const delta = current - previous;
  if (previous === 0) {
    return {
      delta,
      percent: current === 0 ? 0 : null,
    };
  }
  return {
    delta,
    percent: (delta / Math.abs(previous)) * 100,
  };
};

const formatAmount = (value) => Math.round(value).toLocaleString('en-US');

const getFallbackNarrative = ({ language, data }) => {
  const expenseTop = data.expenseCurrent[0];
  const incomeTop = data.incomeCurrent[0];
  const expenseDelta = calcChange(data.current.totalExpense, data.previous.totalExpense);
  const incomeDelta = calcChange(data.current.totalIncome, data.previous.totalIncome);

  if (language === 'en') {
    return [
      `Current period income: ${formatAmount(data.current.totalIncome)} UZS, expense: ${formatAmount(data.current.totalExpense)} UZS.`,
      `Net result: ${formatAmount(data.current.net)} UZS.`,
      expenseTop ? `Top expense category: ${expenseTop.name} (${formatAmount(expenseTop.total)} UZS).` : 'No expense category data for this period.',
      incomeTop ? `Top income source: ${incomeTop.name} (${formatAmount(incomeTop.total)} UZS).` : 'No income source data for this period.',
      expenseDelta.delta >= 0
        ? `Expense increased by ${Math.abs(expenseDelta.percent || 0).toFixed(1)}% compared to previous period.`
        : `Expense decreased by ${Math.abs(expenseDelta.percent || 0).toFixed(1)}% compared to previous period.`,
      incomeDelta.delta >= 0
        ? `Income increased by ${Math.abs(incomeDelta.percent || 0).toFixed(1)}% compared to previous period.`
        : `Income decreased by ${Math.abs(incomeDelta.percent || 0).toFixed(1)}% compared to previous period.`,
    ].join('\n');
  }

  if (language === 'ru') {
    return [
      `Доход за текущий период: ${formatAmount(data.current.totalIncome)} UZS, расход: ${formatAmount(data.current.totalExpense)} UZS.`,
      `Чистый результат: ${formatAmount(data.current.net)} UZS.`,
      expenseTop ? `Крупнейшая категория расхода: ${expenseTop.name} (${formatAmount(expenseTop.total)} UZS).` : 'Нет данных по категориям расходов за этот период.',
      incomeTop ? `Основной источник дохода: ${incomeTop.name} (${formatAmount(incomeTop.total)} UZS).` : 'Нет данных по источникам дохода за этот период.',
      expenseDelta.delta >= 0
        ? `Расход вырос на ${Math.abs(expenseDelta.percent || 0).toFixed(1)}% относительно прошлого периода.`
        : `Расход снизился на ${Math.abs(expenseDelta.percent || 0).toFixed(1)}% относительно прошлого периода.`,
      incomeDelta.delta >= 0
        ? `Доход вырос на ${Math.abs(incomeDelta.percent || 0).toFixed(1)}% относительно прошлого периода.`
        : `Доход снизился на ${Math.abs(incomeDelta.percent || 0).toFixed(1)}% относительно прошлого периода.`,
    ].join('\n');
  }

  return [
    `Joriy davr daromadi: ${formatAmount(data.current.totalIncome)} UZS, xarajati: ${formatAmount(data.current.totalExpense)} UZS.`,
    `Sof natija: ${formatAmount(data.current.net)} UZS.`,
    expenseTop ? `Eng katta xarajat kategoriyasi: ${expenseTop.name} (${formatAmount(expenseTop.total)} UZS).` : 'Joriy davrda xarajat kategoriyalari bo‘yicha ma’lumot topilmadi.',
    incomeTop ? `Eng katta daromad manbai: ${incomeTop.name} (${formatAmount(incomeTop.total)} UZS).` : 'Joriy davrda daromad manbalari bo‘yicha ma’lumot topilmadi.',
    expenseDelta.delta >= 0
      ? `Xarajat oldingi davrga nisbatan ${Math.abs(expenseDelta.percent || 0).toFixed(1)}% oshgan.`
      : `Xarajat oldingi davrga nisbatan ${Math.abs(expenseDelta.percent || 0).toFixed(1)}% kamaygan.`,
    incomeDelta.delta >= 0
      ? `Daromad oldingi davrga nisbatan ${Math.abs(incomeDelta.percent || 0).toFixed(1)}% oshgan.`
      : `Daromad oldingi davrga nisbatan ${Math.abs(incomeDelta.percent || 0).toFixed(1)}% kamaygan.`,
  ].join('\n');
};

const getLanguageInstruction = (language) => {
  if (language === 'en') return 'Write in clear English.';
  if (language === 'ru') return 'Пиши на понятном русском языке.';
  return 'Faqat o‘zbek tilida yozing.';
};

const generateNarrativeWithOpenRouter = async ({ apiKey, model, language, periodMeta, reportData }) => {
  if (!apiKey) {
    return getFallbackNarrative({ language, data: reportData });
  }

  const payload = {
    model: model || DEFAULT_MODEL,
    messages: [
      {
        role: 'system',
        content: `You are a concise financial analyst for a fintech app. ${getLanguageInstruction(language)} Keep output to 5 short bullet points, no markdown headings.`,
      },
      {
        role: 'user',
        content: JSON.stringify({
          period: periodMeta.period,
          currentLabel: periodMeta.labelCurrent,
          previousLabel: periodMeta.labelPrevious,
          current: reportData.current,
          previous: reportData.previous,
          expenseCurrent: reportData.expenseCurrent,
          expensePrevious: reportData.expensePrevious,
          incomeCurrent: reportData.incomeCurrent,
          incomePrevious: reportData.incomePrevious,
        }),
      },
    ],
    temperature: 0.2,
    max_tokens: 280,
  };

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      logger.warn('ai.openrouter_failed', { status: response.status, details: details.slice(0, 500) });
      return getFallbackNarrative({ language, data: reportData });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === 'string' && content.trim()) {
      return content.trim();
    }

    return getFallbackNarrative({ language, data: reportData });
  } catch (error) {
    logger.warn('ai.openrouter_error', { error: error.message });
    return getFallbackNarrative({ language, data: reportData });
  }
};

const getAiTitle = (language, period) => {
  const key = VALID_PERIODS.has(period) ? period : 'daily';
  if (language === 'en') {
    return {
      daily: 'Daily AI Financial Report',
      weekly: 'Weekly AI Financial Report',
      monthly: 'Monthly AI Financial Report',
      yearly: 'Yearly AI Financial Report',
    }[key];
  }
  if (language === 'ru') {
    return {
      daily: 'Ежедневный AI финансовый отчет',
      weekly: 'Еженедельный AI финансовый отчет',
      monthly: 'Ежемесячный AI финансовый отчет',
      yearly: 'Ежегодный AI финансовый отчет',
    }[key];
  }
  return {
    daily: 'Kunlik AI moliyaviy hisobot',
    weekly: 'Haftalik AI moliyaviy hisobot',
    monthly: 'Oylik AI moliyaviy hisobot',
    yearly: 'Yillik AI moliyaviy hisobot',
  }[key];
};

const getOrCreateAiSettings = async (userId) => {
  await db.query(
    'INSERT INTO user_ai_settings (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING',
    [userId]
  );

  const { rows } = await db.query(
    `SELECT user_id, enabled, report_period, delivery_time, timezone, language, model, last_sent_period_key, created_at, updated_at
     FROM user_ai_settings
     WHERE user_id = $1`,
    [userId]
  );
  return rows[0];
};

const createAiReportNotification = async ({ userId, settings, force = false, now = new Date() }) => {
  const scopeUserId = await resolveScopeUserId(userId);
  const periodMeta = getPeriodMeta(settings.report_period, now, settings.timezone);
  if (!force && settings.last_sent_period_key === periodMeta.key) {
    return { sent: false, reason: 'already_sent' };
  }

  const [currentSummary, previousSummary, expenseCurrent, expensePrevious, incomeCurrent, incomePrevious] = await Promise.all([
    getSummaryByRange(scopeUserId, periodMeta.current),
    getSummaryByRange(scopeUserId, periodMeta.previous),
    getCategoriesByRange(scopeUserId, periodMeta.current, 'EXPENSE'),
    getCategoriesByRange(scopeUserId, periodMeta.previous, 'EXPENSE'),
    getCategoriesByRange(scopeUserId, periodMeta.current, 'INCOME'),
    getCategoriesByRange(scopeUserId, periodMeta.previous, 'INCOME'),
  ]);

  const reportData = {
    current: currentSummary,
    previous: previousSummary,
    expenseCurrent,
    expensePrevious,
    incomeCurrent,
    incomePrevious,
  };

  const apiKey = process.env.OPENROUTER_API_KEY || '';
  const text = await generateNarrativeWithOpenRouter({
    apiKey,
    model: settings.model || DEFAULT_MODEL,
    language: VALID_LANGUAGES.has(settings.language) ? settings.language : 'uz',
    periodMeta,
    reportData,
  });

  const title = getAiTitle(settings.language, settings.report_period);
  const periodKey = force ? null : periodMeta.key;

  const { rows } = await db.query(
    `INSERT INTO user_notifications (user_id, type, title, message, payload, period_key)
     VALUES ($1, 'AI_REPORT', $2, $3, $4::jsonb, $5)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    [
      scopeUserId,
      title,
      text,
      JSON.stringify({
        period: settings.report_period,
        timezone: settings.timezone,
        currentRange: periodMeta.current,
        previousRange: periodMeta.previous,
      }),
      periodKey,
    ]
  );

  const inserted = rows.length > 0;
  if (!force) {
    await db.query(
      'UPDATE user_ai_settings SET last_sent_period_key = $1, updated_at = NOW() WHERE user_id = $2',
      [periodMeta.key, userId]
    );
  }

  return {
    sent: inserted,
    reason: inserted ? 'created' : 'duplicate',
    periodKey: periodMeta.key,
  };
};

const ensureDueAiReportForUser = async (userId, now = new Date()) => {
  const scopeUserId = await resolveScopeUserId(userId);
  const lastCheckedAt = dueCheckTimestamps.get(scopeUserId) || 0;
  if (Date.now() - lastCheckedAt < 5000) {
    return { sent: false, reason: 'throttled' };
  }
  dueCheckTimestamps.set(scopeUserId, Date.now());

  const settings = await getOrCreateAiSettings(scopeUserId);

  if (!settings?.enabled) {
    return { sent: false, reason: 'disabled' };
  }

  const periodMeta = getPeriodMeta(settings.report_period, now, settings.timezone);
  if (!isDeliveryDue(periodMeta.clock, settings.delivery_time)) {
    return { sent: false, reason: 'not_due' };
  }

  return createAiReportNotification({
    userId: scopeUserId,
    settings,
    force: false,
    now,
  });
};

let isTickRunning = false;
let schedulerInterval = null;

const runAiSchedulerTick = async () => {
  if (isTickRunning) return;
  isTickRunning = true;

  try {
    const { rows } = await db.query(
      `SELECT user_id, enabled, report_period, delivery_time, timezone, language, model, last_sent_period_key
       FROM user_ai_settings
       WHERE enabled = TRUE`
    );

    const now = new Date();
    for (const row of rows) {
      const scopeUserId = await resolveScopeUserId(row.user_id);
      if (scopeUserId !== row.user_id) {
        continue;
      }

      const periodMeta = getPeriodMeta(row.report_period, now, row.timezone);
      if (!isDeliveryDue(periodMeta.clock, row.delivery_time)) {
        continue;
      }

      await createAiReportNotification({
        userId: scopeUserId,
        settings: row,
        force: false,
        now,
      });
    }
  } catch (error) {
    logger.warn('ai.scheduler_tick_failed', { error: error.message });
  } finally {
    isTickRunning = false;
  }
};

const startAiReportScheduler = () => {
  if (String(process.env.AI_REPORT_SCHEDULER || 'true').toLowerCase() === 'false') {
    logger.info('ai.scheduler_disabled');
    return () => {};
  }

  if (schedulerInterval) {
    return () => clearInterval(schedulerInterval);
  }

  const intervalMs = Number.parseInt(process.env.AI_REPORT_SCHEDULER_INTERVAL_MS || '5000', 10);
  schedulerInterval = setInterval(() => {
    runAiSchedulerTick().catch(() => {});
  }, Number.isFinite(intervalMs) && intervalMs >= 5000 ? intervalMs : 5000);
  schedulerInterval.unref();

  setTimeout(() => {
    runAiSchedulerTick().catch(() => {});
  }, 5000).unref();

  logger.info('ai.scheduler_started', { intervalMs: Number.isFinite(intervalMs) ? intervalMs : 5000 });

  return () => {
    if (schedulerInterval) {
      clearInterval(schedulerInterval);
      schedulerInterval = null;
    }
  };
};

module.exports = {
  VALID_PERIODS,
  VALID_LANGUAGES,
  DEFAULT_MODEL,
  getOrCreateAiSettings,
  createAiReportNotification,
  ensureDueAiReportForUser,
  startAiReportScheduler,
};
