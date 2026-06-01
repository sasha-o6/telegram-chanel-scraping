const test = require('node:test')
const assert = require('node:assert/strict')
const { formatScrapedMessage } = require('../src/formatters/telegramMessage')

test('formats scraped message with fallback channel and keywords', () => {
  const formatted = formatScrapedMessage(
    {
      date: '2026-06-01T00:00:00Z',
      message: 'Потрібен дизайнер',
      postLink: 'https://t.me/example/1',
      keyWords: [['Потрібен'], ['дизайнер']]
    },
    'example'
  )

  assert.match(formatted, /Канал\/чат:\*\* example/)
  assert.match(formatted, /Потрібен дизайнер/)
  assert.match(formatted, /https:\/\/t.me\/example\/1/)
})
