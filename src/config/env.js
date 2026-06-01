function parseInteger(name, value, fallback) {
  if (value == null || value === '') return fallback

  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be an integer`)
  }

  return parsed
}

function requireValue(name, value) {
  if (!value) throw new Error(`${name} is required`)
  return value
}

function loadEnv(source = process.env) {
  const isTest = source.NODE_ENV === 'test'
  const adapter = source.TELEGRAM_ADAPTER || (isTest ? 'fake' : 'gramjs')

  return {
    nodeEnv: source.NODE_ENV || 'development',
    databaseUrl:
      source.DATABASE_URL ||
      'postgres://telegram_scraper:telegram_scraper@localhost:5432/telegram_scraper',
    botToken: isTest
      ? source.BOT_TOKEN || 'test-token'
      : requireValue('BOT_TOKEN', source.BOT_TOKEN),
    encryptionKey: requireValue('ENCRYPTION_KEY', source.ENCRYPTION_KEY),
    globalSchedulerIntervalMinutes: parseInteger(
      'GLOBAL_SCHEDULER_INTERVAL_MINUTES',
      source.GLOBAL_SCHEDULER_INTERVAL_MINUTES,
      20
    ),
    telegramAdapter: adapter,
    tdlibDatabaseDirectory: source.TDLIB_DATABASE_DIRECTORY || '.tdlib',
    tdlibFilesDirectory: source.TDLIB_FILES_DIRECTORY || '.tdlib-files'
  }
}

module.exports = {
  loadEnv
}
