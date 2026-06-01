class TelegramBotApi {
  constructor(token, fetchImpl = fetch) {
    this.token = token
    this.fetch = fetchImpl
    this.offset = 0
  }

  async sendMessage(chatId, text) {
    if (!this.token) return

    await this.fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown'
      })
    })
  }

  async getUpdates() {
    if (!this.token) return []

    const response = await this.fetch(
      `https://api.telegram.org/bot${this.token}/getUpdates?timeout=20&offset=${this.offset}`
    )
    const payload = await response.json()
    if (!payload.ok) throw new Error('Telegram Bot API getUpdates failed')

    const updates = payload.result || []
    if (updates.length > 0) {
      this.offset = updates[updates.length - 1].update_id + 1
    }
    return updates
  }
}

module.exports = {
  TelegramBotApi
}
