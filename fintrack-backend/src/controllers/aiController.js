const db = require('../config/db');
const {
  VALID_PERIODS,
  VALID_LANGUAGES,
  DEFAULT_MODEL,
  getOrCreateAiSettings,
  createAiReportNotification,
} = require('../services/aiReportService');
const { resolveScopeUserId } = require('../services/householdScopeService');

const KEYWORDS = {
  'Oziq-ovqat': ['ovqat', 'non', 'gosht', 'sabzavot', 'meva', 'sut', 'guruch', 'bozor', 'oziq', 'grocery', 'food', 'meal'],
  'Restoran / Kafe': ['restoran', 'restaurant', 'kafe', 'cafe', 'coffee', 'kofe', 'tushlik', 'lunch', 'dinner', 'pizza', 'burger', 'fastfood', 'choyxona', 'osh', 'kabob'],
  'Transport': ['taxi', 'taksi', 'uber', 'yandex', 'avtobus', 'bus', 'metro', 'transport', 'benzin', 'yoqilgi', 'mashina', 'mytaxi', 'maxim'],
  'Kommunal to\'lovlar': ['elektr', 'gaz', 'suv', 'issiqlik', 'utility', 'kommunal'],
  'Sog\'liq': ['dori', 'dorixona', 'shifokor', 'doktor', 'hospital', 'kasalxona', 'klinika', 'apteka', 'pharmacy'],
  'Ta\'lim': ['kurs', 'kitob', 'book', 'talim', 'education', 'university', 'maktab', 'udemy'],
  'Kiyim-kechak': ['kiyim', 'koylak', 'shim', 'poyabzal', 'shoes', 'clothes', 'kurtka'],
  'Ko\'ngil ochar': ['kino', 'cinema', 'film', 'concert', 'konsert', 'oyin', 'game', 'park', 'netflix', 'spotify'],
  'Aloqa / Internet': ['telefon', 'internet', 'mobil', 'mobile', 'beeline', 'ucell', 'uzmobile', 'mobiuz', 'aloqa', 'wifi'],
  'Sayohat': ['sayohat', 'travel', 'mehmonxona', 'hotel', 'samolyot', 'flight', 'tour', 'booking'],
  'Ish haqi': ['maosh', 'ish haqi', 'salary', 'oylik', 'bonus', 'avans'],
  'Frilanserlik': ['freelance', 'frilans', 'buyurtma', 'loyiha', 'project', 'upwork'],
};

const INCOME_CATS = ['Ish haqi', 'Frilanserlik'];
const VALID_TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

const sanitizeSettingsInput = (input = {}) => {
  const next = {};

  if (typeof input.enabled === 'boolean') next.enabled = input.enabled;

  if (typeof input.reportPeriod === 'string') {
    const value = input.reportPeriod.trim().toLowerCase();
    if (VALID_PERIODS.has(value)) next.report_period = value;
  }

  if (typeof input.deliveryTime === 'string') {
    const value = input.deliveryTime.trim();
    if (VALID_TIME_RE.test(value)) next.delivery_time = value;
  }

  if (typeof input.timezone === 'string') {
    const value = input.timezone.trim();
    if (value.length >= 2 && value.length <= 64) next.timezone = value;
  }

  if (typeof input.language === 'string') {
    const value = input.language.trim().toLowerCase();
    if (VALID_LANGUAGES.has(value)) next.language = value;
  }

  if (typeof input.model === 'string') {
    const value = input.model.trim();
    if (value.length >= 3 && value.length <= 120) next.model = value;
  }

  return next;
};

const categorize = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const { description } = req.body;

    if (!description || description.trim().length < 2) {
      return res.json({
        success: true,
        data: { categoryName: 'Boshqa xarajatlar', categoryType: 'EXPENSE', confidence: 0, matched: false }
      });
    }

    const text = description.toLowerCase().trim();
    let bestMatch = null;
    let bestScore = 0;

    for (const [name, keywords] of Object.entries(KEYWORDS)) {
      let score = 0;
      let matched = [];

      for (const kw of keywords) {
        if (text.includes(kw.toLowerCase())) {
          score += 0.5 + (kw.length / text.length) * 0.5;
          matched.push(kw);
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestMatch = { name, matched, score };
      }
    }

    const confidence = Math.min(bestScore / 1.5, 1.0);

    if (!bestMatch || confidence < 0.15) {
      return res.json({
        success: true,
        data: { categoryName: 'Boshqa xarajatlar', categoryType: 'EXPENSE', confidence: 0, matched: false }
      });
    }

    const catType = INCOME_CATS.includes(bestMatch.name) ? 'INCOME' : 'EXPENSE';

    const { rows } = await db.query(
      'SELECT id, name, type, icon, color FROM categories WHERE name = $1 AND (user_id IS NULL OR user_id = $2) LIMIT 1',
      [bestMatch.name, scopeUserId]
    );

    const cat = rows[0] || null;

    res.json({
      success: true,
      data: {
        categoryName: bestMatch.name,
        categoryType: catType,
        categoryId: cat ? cat.id : null,
        icon: cat ? cat.icon : '📌',
        color: cat ? cat.color : '#607D8B',
        confidence: Math.round(confidence * 100) / 100,
        matched: true,
        matchedKeywords: bestMatch.matched
      }
    });
  } catch (error) {
    next(error);
  }
};

const getSettings = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const settings = await getOrCreateAiSettings(scopeUserId);
    res.json({
      success: true,
      data: {
        enabled: Boolean(settings.enabled),
        reportPeriod: settings.report_period,
        deliveryTime: settings.delivery_time,
        timezone: settings.timezone,
        language: settings.language,
        model: settings.model || DEFAULT_MODEL,
        apiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        updatedAt: settings.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

const updateSettings = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    await getOrCreateAiSettings(scopeUserId);
    const patch = sanitizeSettingsInput(req.body || {});

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: 'Yangilanadigan sozlama topilmadi' });
    }

    const sets = [];
    const values = [];
    let idx = 1;

    Object.entries(patch).forEach(([key, value]) => {
      sets.push(`${key} = $${idx}`);
      values.push(value);
      idx += 1;
    });

    values.push(scopeUserId);

    const { rows } = await db.query(
      `UPDATE user_ai_settings
       SET ${sets.join(', ')}, updated_at = NOW()
       WHERE user_id = $${idx}
       RETURNING enabled, report_period, delivery_time, timezone, language, model, updated_at`,
      values
    );

    const updated = rows[0];
    res.json({
      success: true,
      data: {
        enabled: Boolean(updated.enabled),
        reportPeriod: updated.report_period,
        deliveryTime: updated.delivery_time,
        timezone: updated.timezone,
        language: updated.language,
        model: updated.model || DEFAULT_MODEL,
        apiConfigured: Boolean(process.env.OPENROUTER_API_KEY),
        updatedAt: updated.updated_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

const sendReportNow = async (req, res, next) => {
  try {
    const scopeUserId = await resolveScopeUserId(req.user.id);
    const settings = await getOrCreateAiSettings(scopeUserId);
    const result = await createAiReportNotification({
      userId: scopeUserId,
      settings,
      force: true,
      now: new Date(),
    });

    res.json({
      success: true,
      data: {
        sent: result.sent,
        reason: result.reason,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { categorize, getSettings, updateSettings, sendReportNow };
