const SESSION_EXPIRED_CODES = new Set([
  'AUTH_KEY_UNREGISTERED',
  'SESSION_REVOKED',
  'SESSION_EXPIRED'
])

function isSessionExpiredError(err) {
  return (
    SESSION_EXPIRED_CODES.has(err?.code) ||
    /session|auth/i.test(err?.message || '')
  )
}

class FakeTelegramAccountClient {
  async startAuthorization() {
    return 'code'
  }

  async submitCode({ code }) {
    if (code === '2fa') return { nextStep: 'password' }
    return { stringSession: `fake-session-${Date.now()}` }
  }

  async submitPassword() {
    return { stringSession: `fake-session-${Date.now()}` }
  }

  async getMessages(source, { limit }) {
    return [
      {
        id: 1,
        date: new Date().toISOString(),
        message: 'шукаю фриланс дизайнера',
        sourceId: String(source),
        postLink: `https://t.me/${source}/1`,
        channelTitle: String(source)
      }
    ].slice(0, limit)
  }

  async sendMessage(destination, message) {
    return { destination, message, ok: true }
  }
}

class TdlTelegramAccountClient {
  constructor(env) {
    this.env = env
    this.client = null
  }

  async loadTdl() {
    const tdl = await import('tdl')
    const prebuilt = await import('prebuilt-tdlib')
    tdl.configure({ tdjson: prebuilt.getTdjson() })
    return tdl
  }

  async createClient({ apiId, apiHash, stringSession }) {
    const tdl = await this.loadTdl()
    const client = tdl.createClient({
      apiId,
      apiHash,
      databaseDirectory: this.env.tdlibDatabaseDirectory,
      filesDirectory: this.env.tdlibFilesDirectory
    })

    if (stringSession) {
      await client.login(() => ({ type: 'user', getAuthData: () => ({}) }))
    }

    return client
  }

  async startAuthorization() {
    throw new Error(
      'TDLib interactive auth is exposed through adapter seam but must be wired to selected tdl auth API during implementation checkpoint'
    )
  }

  async submitCode() {
    throw new Error(
      'TDLib submitCode is not available until auth checkpoint is wired'
    )
  }

  async submitPassword() {
    throw new Error(
      'TDLib submitPassword is not available until auth checkpoint is wired'
    )
  }

  async getMessages() {
    throw new Error(
      'TDLib getMessages is not available until adapter checkpoint is wired'
    )
  }

  async sendMessage() {
    throw new Error(
      'TDLib sendMessage is not available until adapter checkpoint is wired'
    )
  }
}

class GramJsTelegramAccountClient {
  async createClient({ apiId, apiHash, stringSession }) {
    const { TelegramClient } = require('telegram')
    const { StringSession } = require('telegram/sessions')
    const client = new TelegramClient(
      new StringSession(stringSession || ''),
      Number(apiId),
      apiHash,
      { connectionRetries: 5 }
    )
    return client
  }

  async finishAuthorization({ apiId, apiHash, phoneNumber, code, password }) {
    const client = await this.createClient({
      apiId,
      apiHash,
      stringSession: ''
    })
    await client.start({
      phoneNumber: async () => phoneNumber,
      phoneCode: async () => code,
      password: async () => password || '',
      onError: err => {
        throw err
      }
    })
    const stringSession = client.session.save()
    await client.disconnect()
    return { stringSession }
  }

  async getMessages(source, { apiId, apiHash, stringSession, limit }) {
    const client = await this.createClient({ apiId, apiHash, stringSession })
    await client.connect()
    try {
      const messages = await client.getMessages(source, { limit })
      return messages
        .filter(message => message?.message)
        .map(message => ({
          id: message.id,
          date: new Date(message.date * 1000).toISOString(),
          message: message.message,
          sourceId: String(source),
          postLink: `https://t.me/${createChannelLinkId(source)}/${message.id}`,
          channelTitle: message?.chat?.title || ''
        }))
    } finally {
      await client.disconnect()
    }
  }

  async sendMessage(destination, message, credentials) {
    const client = await this.createClient(credentials)
    await client.connect()
    try {
      return client.sendMessage(destination, { message })
    } finally {
      await client.disconnect()
    }
  }
}

function createChannelLinkId(channel) {
  return String(channel).replace('-100', 'c/')
}

function createTelegramAccountClient(env) {
  if (env.telegramAdapter === 'gramjs') return new GramJsTelegramAccountClient()
  if (env.telegramAdapter === 'tdlib') return new TdlTelegramAccountClient(env)
  return new FakeTelegramAccountClient()
}

module.exports = {
  FakeTelegramAccountClient,
  GramJsTelegramAccountClient,
  TdlTelegramAccountClient,
  createTelegramAccountClient,
  isSessionExpiredError
}
