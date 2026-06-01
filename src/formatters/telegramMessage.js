function formatScrapedMessage(msg, channel) {
  return (
    `**Канал/чат:** ${msg.channelTitle || channel}\n` +
    `**Дата:** ${new Date(msg.date).toLocaleString()}\n` +
    `**Повідомлення:**\n\n` +
    msg.message +
    `\n\n\n` +
    `**Ключові слова:** \n` +
    (msg.keyWords?.[0] || []).join(', ') +
    ' ___ ' +
    (msg.keyWords?.[1] || []).join(', ') +
    `\n` +
    `**Посилання:** \n` +
    msg.postLink
  )
}

module.exports = {
  formatScrapedMessage
}
