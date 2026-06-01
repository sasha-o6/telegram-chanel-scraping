const { loadEnv } = require('./src/config/env')
const { createPool } = require('./src/db/pool')
const { createBot } = require('./src/bot/bot')
const { createScheduler } = require('./src/scheduler/scheduler')
const { createTelegramAccountClient } = require('./src/telegram/accountClient')
const { logInfo, logError } = require('./src/logger')

async function main() {
  const env = loadEnv(process.env)
  const pool = createPool(env.databaseUrl)
  const telegramClient = createTelegramAccountClient(env)

  const bot = createBot({
    token: env.botToken,
    pool,
    telegramClient
  })

  const scheduler = createScheduler({
    pool,
    telegramClient,
    globalIntervalMinutes: env.globalSchedulerIntervalMinutes,
    notifier: bot.notifier
  })

  const shutdown = async signal => {
    logInfo('shutdown_started', { signal })
    scheduler.stop()
    bot.stop()
    await pool.end()
    logInfo('shutdown_complete')
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  await bot.start()
  await scheduler.start()
  logInfo('app_started')
}

main().catch(err => {
  logError('app_failed', err)
  process.exit(1)
})
