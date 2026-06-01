const {
  listDueConfigs,
  lockConfig,
  finishConfigRun
} = require('../configs/configRepository')
const { createSecretBox } = require('../crypto/secrets')
const {
  listPendingDeliveries,
  markDeliverySent,
  markDeliveryFailed
} = require('../delivery/deliveryRepository')
const { scrapeConfig, recordScrapeRun } = require('../scraper/scraper')
const { logError, logInfo } = require('../logger')

function createScheduler({
  pool,
  telegramClient,
  globalIntervalMinutes = 20,
  notifier,
  env = process.env
}) {
  let timer = null
  let running = false

  async function deliverOutbox() {
    const secretBox = createSecretBox(env.ENCRYPTION_KEY)
    const pending = await listPendingDeliveries(pool)
    for (const delivery of pending) {
      try {
        await telegramClient.sendMessage(
          delivery.destination_chat,
          delivery.formatted_message,
          {
            apiId: Number(secretBox.decrypt(delivery.encrypted_api_id)),
            apiHash: secretBox.decrypt(delivery.encrypted_api_hash),
            stringSession: secretBox.decrypt(delivery.encrypted_string_session)
          }
        )
        await markDeliverySent(pool, delivery)
      } catch (err) {
        await markDeliveryFailed(pool, delivery.id, err)
      }
    }
  }

  async function tick() {
    const configs = await listDueConfigs(pool)
    logInfo('scheduler_tick', { selected: configs.length })

    for (const config of configs) {
      const locked = await lockConfig(pool, config.id)
      if (!locked) continue

      try {
        const result = await scrapeConfig({
          pool,
          config,
          telegramClient,
          encryptionKey: env.ENCRYPTION_KEY,
          notifier
        })
        await recordScrapeRun(pool, config.id, result.status)
        await finishConfigRun(pool, config.id)
      } catch (err) {
        await recordScrapeRun(pool, config.id, 'failed', err)
        await finishConfigRun(pool, config.id)
      }
    }

    await deliverOutbox()
  }

  function scheduleNext() {
    if (!running) return
    timer = setTimeout(
      async () => {
        try {
          await tick()
        } catch (err) {
          logError('scheduler_tick_failed', err)
        } finally {
          scheduleNext()
        }
      },
      globalIntervalMinutes * 60 * 1000
    )
  }

  return {
    tick,
    deliverOutbox,
    async start() {
      running = true
      await tick()
      scheduleNext()
    },
    stop() {
      running = false
      if (timer) clearTimeout(timer)
    }
  }
}

module.exports = {
  createScheduler
}
