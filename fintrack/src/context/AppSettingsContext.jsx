import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { interpolate, resolvePath } from '../i18n/translate'
import uz from '../locales/uz/common.json'
import en from '../locales/en/common.json'
import ru from '../locales/ru/common.json'

const SETTINGS_KEY = 'fintrack:app-settings:v1'

const dictionaries = { uz, en, ru }
const languageToLocale = {
  uz: 'uz-UZ',
  en: 'en-US',
  ru: 'ru-RU',
}

const DEFAULT_SETTINGS = {
  language: 'uz',
  currency: 'UZS',
  theme: 'dark',
  notifications: {
    budgetWarning: true,
    highSpendingAlert: true,
    monthlyReportReminder: true,
  },
  aiAdviceEnabled: false,
}

const AppSettingsContext = createContext(null)

const mergeSettings = (saved = {}) => ({
  ...DEFAULT_SETTINGS,
  ...saved,
  notifications: {
    ...DEFAULT_SETTINGS.notifications,
    ...(saved.notifications || {}),
  },
})

const normalizeLanguage = (language) => (Object.keys(dictionaries).includes(language) ? language : 'uz')
const normalizeTheme = (theme) => (theme === 'light' ? 'light' : 'dark')
const normalizeCurrency = (currency) => ['UZS', 'USD', 'EUR', 'RUB'].includes(currency) ? currency : 'UZS'

export function AppSettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try {
      const savedRaw = localStorage.getItem(SETTINGS_KEY)
      if (!savedRaw) return DEFAULT_SETTINGS
      const saved = JSON.parse(savedRaw)
      const merged = mergeSettings(saved)
      return {
        ...merged,
        language: normalizeLanguage(merged.language),
        theme: normalizeTheme(merged.theme),
        currency: normalizeCurrency(merged.currency),
      }
    } catch {
      return DEFAULT_SETTINGS
    }
  })

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  }, [settings])

  useEffect(() => {
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    root.classList.add(settings.theme === 'light' ? 'theme-light' : 'theme-dark')
  }, [settings.theme])

  const setLanguage = useCallback((language) => {
    setSettings((prev) => ({ ...prev, language: normalizeLanguage(language) }))
  }, [])

  const setCurrency = useCallback((currency) => {
    setSettings((prev) => ({ ...prev, currency: normalizeCurrency(currency) }))
  }, [])

  const setTheme = useCallback((theme) => {
    setSettings((prev) => ({ ...prev, theme: normalizeTheme(theme) }))
  }, [])

  const setNotification = useCallback((key, value) => {
    setSettings((prev) => ({
      ...prev,
      notifications: {
        ...prev.notifications,
        [key]: Boolean(value),
      },
    }))
  }, [])

  const setAiAdviceEnabled = useCallback((value) => {
    setSettings((prev) => ({ ...prev, aiAdviceEnabled: Boolean(value) }))
  }, [])

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [])

  const t = useCallback((key, vars = {}) => {
    const lang = normalizeLanguage(settings.language)
    const dict = dictionaries[lang] || dictionaries.uz
    const value = resolvePath(dict, key)
    const fallback = resolvePath(dictionaries.uz, key) ?? key
    return interpolate(value ?? fallback, vars)
  }, [settings.language])

  const locale = languageToLocale[settings.language] || languageToLocale.uz

  const formatMoney = useCallback((amount, options = {}) => {
    const numeric = Number.parseFloat(amount) || 0
    const currency = normalizeCurrency(options.currency || settings.currency)
    const maximumFractionDigits = currency === 'UZS' ? 0 : 2
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits,
    }).format(numeric)
  }, [locale, settings.currency])

  const formatNumber = useCallback((value) => {
    const numeric = Number.parseFloat(value) || 0
    return new Intl.NumberFormat(locale).format(numeric)
  }, [locale])

  const value = useMemo(() => ({
    settings,
    language: settings.language,
    currency: settings.currency,
    theme: settings.theme,
    t,
    formatMoney,
    formatNumber,
    setLanguage,
    setCurrency,
    setTheme,
    setNotification,
    setAiAdviceEnabled,
    resetSettings,
  }), [
    settings,
    t,
    formatMoney,
    formatNumber,
    setLanguage,
    setCurrency,
    setTheme,
    setNotification,
    setAiAdviceEnabled,
    resetSettings,
  ])

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  )
}

export const useAppSettings = () => {
  const context = useContext(AppSettingsContext)
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider')
  }
  return context
}

export const APP_SETTINGS_KEY = SETTINGS_KEY
