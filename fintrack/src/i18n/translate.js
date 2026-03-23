export const resolvePath = (obj, path) => {
  if (!obj || !path) return undefined
  return path.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), obj)
}

export const interpolate = (template, vars = {}) => {
  if (typeof template !== 'string') return template
  return template.replace(/\{\{(.*?)\}\}/g, (_, key) => {
    const trimmed = key.trim()
    return vars[trimmed] !== undefined ? String(vars[trimmed]) : ''
  })
}

