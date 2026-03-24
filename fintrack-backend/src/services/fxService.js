const SUPPORTED_CURRENCIES = ['UZS', 'USD', 'EUR', 'RUB'];

const DEFAULT_UZS_RATES = {
  UZS: 1,
  USD: 12800,
  EUR: 13900,
  RUB: 145,
};

const toNumber = (value) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeRates = (input = {}) => {
  const merged = { ...DEFAULT_UZS_RATES };

  Object.entries(input).forEach(([currency, rawValue]) => {
    const code = String(currency || '').trim().toUpperCase();
    if (!SUPPORTED_CURRENCIES.includes(code)) return;
    const value = toNumber(rawValue);
    if (!value || value <= 0) return;
    merged[code] = value;
  });

  return merged;
};

const parseRatesFromEnv = () => {
  const raw = process.env.FX_RATES_JSON;
  if (!raw) return DEFAULT_UZS_RATES;

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return DEFAULT_UZS_RATES;
    return normalizeRates(parsed);
  } catch {
    return DEFAULT_UZS_RATES;
  }
};

const getRates = () => parseRatesFromEnv();
let liveRatesCache = null;
let liveRatesFetchedAt = 0;
const LIVE_RATES_TTL_MS = Number.parseInt(process.env.FX_LIVE_CACHE_TTL_MS || '1800000', 10);
const FX_LIVE_ENABLED = String(process.env.FX_LIVE_ENABLED || 'false').toLowerCase() === 'true';

const buildRatesFromUsdBase = (usdRates = {}) => {
  const uzsPerUsd = toNumber(usdRates.UZS);
  const eurPerUsd = toNumber(usdRates.EUR);
  const rubPerUsd = toNumber(usdRates.RUB);
  if (!uzsPerUsd || !eurPerUsd || !rubPerUsd) return null;

  const rates = {
    UZS: 1,
    USD: uzsPerUsd,
    EUR: uzsPerUsd / eurPerUsd,
    RUB: uzsPerUsd / rubPerUsd,
  };
  return normalizeRates(rates);
};

const fetchLiveRates = async () => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      method: 'GET',
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    const apiRates = data?.rates;
    if (!apiRates || typeof apiRates !== 'object') return null;
    return buildRatesFromUsdBase(apiRates);
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
};

const getRatesWithLiveFallback = async () => {
  if (!FX_LIVE_ENABLED) {
    return getRates();
  }

  const now = Date.now();
  if (liveRatesCache && now - liveRatesFetchedAt < LIVE_RATES_TTL_MS) {
    return liveRatesCache;
  }

  const fetched = await fetchLiveRates();
  if (fetched) {
    liveRatesCache = fetched;
    liveRatesFetchedAt = now;
    return fetched;
  }

  return getRates();
};

const getCurrencyPrecision = (currency) => (String(currency || '').toUpperCase() === 'UZS' ? 0 : 2);

const roundByPrecision = (value, precision) => {
  const factor = 10 ** Math.max(0, precision);
  return Math.round((Number(value || 0) + Number.EPSILON) * factor) / factor;
};

const normalizeCurrency = (currency) => String(currency || '').trim().toUpperCase();

const validateCurrency = (currency) => {
  const code = normalizeCurrency(currency);
  return SUPPORTED_CURRENCIES.includes(code) ? code : null;
};

const getRate = (fromCurrency, toCurrency, rates = getRates()) => {
  const from = validateCurrency(fromCurrency);
  const to = validateCurrency(toCurrency);

  if (!from || !to) {
    return { error: 'Valyuta qollab-quvvatlanmaydi' };
  }

  if (from === to) {
    return { rate: 1, fromCurrency: from, toCurrency: to };
  }

  const fromInUzs = toNumber(rates[from]);
  const toInUzs = toNumber(rates[to]);

  if (!fromInUzs || fromInUzs <= 0 || !toInUzs || toInUzs <= 0) {
    return { error: 'Valyuta kursi topilmadi' };
  }

  return {
    rate: fromInUzs / toInUzs,
    fromCurrency: from,
    toCurrency: to,
  };
};

const buildQuote = ({ amount, fromCurrency, toCurrency, rates = getRates() }) => {
  const normalizedAmount = toNumber(amount);
  if (!normalizedAmount || normalizedAmount <= 0) {
    return { error: 'Summa notogri' };
  }

  const conversion = getRate(fromCurrency, toCurrency, rates);
  if (conversion.error) return { error: conversion.error };

  const fromPrecision = getCurrencyPrecision(conversion.fromCurrency);
  const toPrecision = getCurrencyPrecision(conversion.toCurrency);

  const fromAmount = roundByPrecision(normalizedAmount, fromPrecision);
  const toAmount = roundByPrecision(fromAmount * conversion.rate, toPrecision);

  if (fromAmount <= 0) {
    return { error: 'Summa juda kichik' };
  }
  if (toAmount <= 0) {
    return { error: 'Kiritilgan summa tanlangan valyuta uchun juda kichik' };
  }

  return {
    fromCurrency: conversion.fromCurrency,
    toCurrency: conversion.toCurrency,
    fromAmount,
    toAmount,
    exchangeRate: conversion.rate,
  };
};

module.exports = {
  SUPPORTED_CURRENCIES,
  getRates,
  getRatesWithLiveFallback,
  getRate,
  buildQuote,
  getCurrencyPrecision,
  roundByPrecision,
};
