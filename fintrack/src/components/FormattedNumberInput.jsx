const normalizeNumberString = (value, { allowDecimal = true, maxDecimals = 2 } = {}) => {
  const input = String(value ?? '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .replace(/[’']/g, '')

  if (!input) return ''

  if (!allowDecimal) {
    const digitsOnly = input.replace(/\D/g, '')
    if (!digitsOnly) return ''
    return digitsOnly.replace(/^0+(?=\d)/, '')
  }

  let cleaned = input.replace(/[^0-9.]/g, '')
  if (!cleaned) return ''

  const firstDot = cleaned.indexOf('.')
  if (firstDot === -1) {
    return cleaned.replace(/^0+(?=\d)/, '')
  }

  const intPart = cleaned.slice(0, firstDot).replace(/\./g, '')
  const decPartRaw = cleaned.slice(firstDot + 1).replace(/\./g, '')
  const decPart = decPartRaw.slice(0, Math.max(maxDecimals, 0))
  const normalizedInt = (intPart || '0').replace(/^0+(?=\d)/, '')
  const keepTrailingDot = input.endsWith('.') && decPart.length === 0

  if (keepTrailingDot) {
    return `${normalizedInt}.`
  }

  return decPart.length ? `${normalizedInt}.${decPart}` : normalizedInt
}

const formatNumberString = (rawValue, { allowDecimal = true } = {}) => {
  const raw = String(rawValue ?? '')
  if (!raw) return ''

  if (!allowDecimal || !raw.includes('.')) {
    const intRaw = raw.replace(/\D/g, '')
    if (!intRaw) return ''
    return Number(intRaw).toLocaleString('uz-UZ')
  }

  const hasTrailingDot = raw.endsWith('.')
  const [intPart, decPart = ''] = raw.split('.')
  const safeInt = intPart.replace(/\D/g, '') || '0'
  const formattedInt = Number(safeInt).toLocaleString('uz-UZ')

  if (hasTrailingDot) {
    return `${formattedInt}.`
  }

  return `${formattedInt}.${decPart}`
}

export default function FormattedNumberInput({
  value,
  onChange,
  allowDecimal = true,
  maxDecimals = 2,
  className = '',
  ...rest
}) {
  const raw = String(value ?? '')
  const displayValue = formatNumberString(raw, { allowDecimal })

  return (
    <input
      {...rest}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      value={displayValue}
      onChange={(e) => {
        const normalized = normalizeNumberString(e.target.value, { allowDecimal, maxDecimals })
        onChange?.(normalized)
      }}
      className={className}
    />
  )
}

