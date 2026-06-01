const { createSecretBox } = require('../crypto/secrets')
const { markSessionStatus } = require('../secrets/telegramSecretRepository')
const { filterMessages } = require('../filtering/messageFilter')
const { formatScrapedMessage } = require('../formatters/telegramMessage')
const { enqueueDelivery } = require('../delivery/deliveryRepository')
const { isSessionExpiredError } = require('../telegram/accountClient')
const { logError, logInfo } = require('../logger')

function hasRequiredSession(config) {
  return (
    config.encryptedApiId &&
    config.encryptedApiHash &&
    config.encryptedStringSession &&
    config.sessionStatus === 'active'
  )
}

function getNotificationChatId(config) {
  return config.telegramUserId || config.userId
}

async function scrapeConfig({
  pool,
  config,
  telegramClient,
  encryptionKey,
  notifier
}) {
  if (!hasRequiredSession(config)) {
    await markSessionStatus(pool, config.userId, 'reauthorization_required')
    await notifier.sendAuthRequired(getNotificationChatId(config))
    return { status: 'skipped_missing_session' }
  }

  const secretBox = createSecretBox(encryptionKey)
  const credentials = {
    apiId: Number(secretBox.decrypt(config.encryptedApiId)),
    apiHash: secretBox.decrypt(config.encryptedApiHash),
    stringSession: secretBox.decrypt(config.encryptedStringSession)
  }

  let queued = 0

  try {
    for (const source of config.channels) {
      const messages = await telegramClient.getMessages(source, {
        ...credentials,
        limit: config.limit
      })
      const filtered = filterMessages(messages, config)

      for (const message of filtered) {
        const delivery = await enqueueDelivery(pool, {
          userId: config.userId,
          configId: config.id,
          sourceId: String(source),
          messageId: message.id,
          postLink: message.postLink,
          destinationChat: config.channelToSend,
          formattedMessage: formatScrapedMessage(message, source)
        })
        if (delivery) queued += 1
      }
    }

    logInfo('scrape_config_complete', { configId: config.id, queued })
    return { status: 'completed', queued }
  } catch (err) {
    if (isSessionExpiredError(err)) {
      await markSessionStatus(pool, config.userId, 'reauthorization_required')
      await notifier.sendAuthRequired(getNotificationChatId(config))
      return { status: 'skipped_expired_session' }
    }

    logError('scrape_config_failed', err, { configId: config.id })
    throw err
  }
}

async function recordScrapeRun(pool, configId, status, err = null) {
  await pool.query(
    `
      insert into scrape_runs(config_id, status, error_code, error_message, completed_at)
      values($1, $2, $3, $4, now())
    `,
    [configId, status, err?.code || null, err?.message || null]
  )
}

module.exports = {
  hasRequiredSession,
  getNotificationChatId,
  scrapeConfig,
  recordScrapeRun
}
