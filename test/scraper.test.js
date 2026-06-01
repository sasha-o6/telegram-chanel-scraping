const test = require('node:test')
const assert = require('node:assert/strict')
const {
  getNotificationChatId,
  hasRequiredSession
} = require('../src/scraper/scraper')

test('uses Telegram user id for scraper notifications when available', () => {
  assert.equal(getNotificationChatId({ userId: 1, telegramUserId: 999 }), 999)
})

test('falls back to internal user id only when Telegram id is unavailable', () => {
  assert.equal(getNotificationChatId({ userId: 1 }), 1)
})

test('requires active encrypted session fields before scraping', () => {
  assert.equal(
    hasRequiredSession({
      encryptedApiId: 'a',
      encryptedApiHash: 'b',
      encryptedStringSession: 'c',
      sessionStatus: 'active'
    }),
    true
  )
  assert.equal(
    hasRequiredSession({
      encryptedApiId: 'a',
      encryptedApiHash: 'b',
      encryptedStringSession: 'c',
      sessionStatus: 'missing'
    }),
    false
  )
})
