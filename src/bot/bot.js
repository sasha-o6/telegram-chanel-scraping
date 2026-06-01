const { TelegramBotApi } = require('./botApi')
const { MESSAGES, statusMessage } = require('./messages')
const { upsertBotUser } = require('../users/userRepository')
const {
  ensureConfig,
  getConfig,
  updateConfig,
  deleteConfig
} = require('../configs/configRepository')
const {
  beginAuthorization,
  handleAuthorizationInput
} = require('../auth/authFlow')
const { createSecretBox } = require('../crypto/secrets')
const { upsertSecrets } = require('../secrets/telegramSecretRepository')
const { logError, logInfo } = require('../logger')

function parseUpdate(update) {
  const message = update.message || update.edited_message
  if (!message) return null
  return {
    chat: message.chat,
    from: message.from,
    text: message.text || ''
  }
}

function parseValue(key, rawValue) {
  if (['isEnable'].includes(key))
    return ['true', '1', 'yes', 'on'].includes(rawValue)
  if (['days', 'limit', 'intervalMinutes', 'apiId'].includes(key))
    return Number(rawValue)
  if (['channels', 'keywords', 'keywords2', 'banWords'].includes(key)) {
    return rawValue
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  }
  return rawValue
}

function createBot({
  token,
  pool,
  telegramClient,
  fetchImpl = fetch,
  env = process.env
}) {
  const api = new TelegramBotApi(token, fetchImpl)
  let running = false
  let pollTimer = null

  const notifier = {
    send: (chatId, text) => api.sendMessage(chatId, text),
    sendAuthRequired: chatId => api.sendMessage(chatId, MESSAGES.authRequired)
  }

  async function handle(updateRaw) {
    const update = parseUpdate(updateRaw)
    if (!update?.from) return

    const user = await upsertBotUser(pool, update.from)
    const text = update.text.trim()

    try {
      if (text === '/start') {
        await ensureConfig(pool, user.id)
        await api.sendMessage(update.chat.id, MESSAGES.start)
        return
      }

      if (text === '/config_help') {
        await api.sendMessage(update.chat.id, MESSAGES.configHelp)
        return
      }

      if (text === '/get_config') {
        await api.sendMessage(
          update.chat.id,
          statusMessage(await getConfig(pool, user.id))
        )
        return
      }

      if (text === '/delete_config') {
        await deleteConfig(pool, user.id)
        await api.sendMessage(update.chat.id, 'Конфіг видалено.')
        return
      }

      if (text === '/auth') {
        if (update.chat.type !== 'private') {
          await api.sendMessage(update.chat.id, MESSAGES.privateAuthOnly)
          return
        }
        await beginAuthorization(pool, user, update)
        await api.sendMessage(update.chat.id, MESSAGES.authStart)
        return
      }

      if (text.startsWith('/set ')) {
        const [, key, ...rest] = text.split(' ')
        const rawValue = rest.join(' ').trim()

        if (['apiId', 'apiHash'].includes(key)) {
          const secretBox = createSecretBox(env.ENCRYPTION_KEY)
          await upsertSecrets(pool, secretBox, user.id, {
            [key]: parseValue(key, rawValue),
            sessionStatus: 'missing'
          })
        } else {
          await updateConfig(pool, user.id, {
            [key]: parseValue(key, rawValue)
          })
        }

        await api.sendMessage(update.chat.id, 'Збережено.')
        return
      }

      const authResult = await handleAuthorizationInput({
        pool,
        encryptionKey: env.ENCRYPTION_KEY,
        telegramClient,
        user,
        update
      })

      if (authResult?.currentStep === 'complete') {
        await api.sendMessage(update.chat.id, MESSAGES.authComplete)
      } else if (authResult?.currentStep) {
        await api.sendMessage(
          update.chat.id,
          `Наступний крок: ${authResult.currentStep}`
        )
      } else {
        await api.sendMessage(update.chat.id, MESSAGES.unknown)
      }
    } catch (err) {
      logError('bot_update_failed', err, {
        userId: user.id,
        chatId: update.chat.id
      })
      await api.sendMessage(update.chat.id, `Помилка: ${err.message}`)
    }
  }

  async function poll() {
    if (!running) return
    try {
      const updates = await api.getUpdates()
      for (const update of updates) await handle(update)
    } catch (err) {
      logError('bot_poll_failed', err)
    } finally {
      if (running) pollTimer = setTimeout(poll, 1000)
    }
  }

  return {
    notifier,
    handle,
    async start() {
      running = true
      logInfo('bot_started')
      poll()
    },
    stop() {
      running = false
      if (pollTimer) clearTimeout(pollTimer)
    }
  }
}

module.exports = {
  createBot,
  parseValue,
  parseUpdate
}
