const normalizeCategoryName = (name) => String(name || '')
  .trim()
  .toLowerCase()
  .replace(/['\u2019]/g, '')
  .replace(/\s+/g, ' ')

const CATEGORY_KEY_MAP = new Map([
  ['oziq-ovqat', 'food'],
  ['transport', 'transport'],
  ['kommunal', 'utilities'],
  ['kommunal tolovlar', 'utilities'],
  ['soglik', 'health'],
  ['sogliq', 'health'],
  ['kiyim', 'clothes'],
  ['kiyim-kechak', 'clothes'],
  ['restoran', 'restaurant'],
  ['restoran / kafe', 'restaurant'],
  ['kongil ochar', 'entertainment'],
  ['kengil ochar', 'entertainment'],
  ['talim', 'education'],
  ['aloqa', 'communication'],
  ['aloqa / internet', 'communication'],
  ['sayohat', 'travel'],
  ['boshqa', 'other'],
  ['boshqa xarajatlar', 'other'],
  ['ish haqi', 'salary'],
  ['frilanserlik', 'freelance'],
  ['investitsiya', 'investment'],
  ['boshqa daromad', 'otherIncome'],
])

export const getCategoryTranslationKey = (name) => {
  const normalized = normalizeCategoryName(name)
  return CATEGORY_KEY_MAP.get(normalized) || null
}

export const translateCategoryName = (name, t) => {
  const key = getCategoryTranslationKey(name)
  if (!key) return name || t('common.unknown')
  return t(`categories.system.${key}`)
}
