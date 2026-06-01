const AUTH_FIELDS = new Set([
  'apiId',
  'apiHash',
  'stringSessionSTR',
  'stringSession',
  'phone',
  'phoneNumber',
  'code',
  'password',
  'token',
  'message',
  'text'
])

function redact(value) {
  if (Array.isArray(value)) return value.map(redact)
  if (!value || typeof value !== 'object') return value

  return Object.fromEntries(
    Object.entries(value).map(([key, nested]) => [
      key,
      AUTH_FIELDS.has(key) ? '[REDACTED]' : redact(nested)
    ])
  )
}

function logInfo(event, details = {}) {
  console.log(JSON.stringify({ level: 'info', event, ...redact(details) }))
}

function logWarn(event, details = {}) {
  console.warn(JSON.stringify({ level: 'warn', event, ...redact(details) }))
}

function logError(event, err, details = {}) {
  console.error(
    JSON.stringify({
      level: 'error',
      event,
      message: err?.message || String(err),
      ...redact(details)
    })
  )
}

module.exports = {
  redact,
  logInfo,
  logWarn,
  logError
}
