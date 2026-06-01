function normalizeList(value) {
  return Array.isArray(value) ? value.filter(Boolean) : []
}

function containsAny(text, words) {
  return normalizeList(words).some(word =>
    text.includes(String(word).toLowerCase())
  )
}

function filterMessage(message, config) {
  if (!message?.message) return null

  const text = message.message.toLowerCase()
  const keywords = normalizeList(config.keywords)
  const keywords2 = normalizeList(config.keywords2)
  const banWords = normalizeList(config.banWords)

  if (!containsAny(text, keywords)) return null
  if (containsAny(text, banWords)) return null
  if (keywords2.length > 0 && !containsAny(text, keywords2)) return null

  return {
    ...message,
    keyWords: [
      keywords.filter(word => text.includes(String(word).toLowerCase())),
      keywords2.filter(word => text.includes(String(word).toLowerCase()))
    ]
  }
}

function filterMessages(messages, config, now = new Date()) {
  const boundary = now.getTime() - config.days * 24 * 60 * 60 * 1000

  return messages
    .filter(message => new Date(message.date).getTime() >= boundary)
    .map(message => filterMessage(message, config))
    .filter(Boolean)
}

module.exports = {
  filterMessage,
  filterMessages
}
