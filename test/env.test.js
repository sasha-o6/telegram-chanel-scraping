const test = require('node:test')
const assert = require('node:assert/strict')
const { loadEnv } = require('../src/config/env')

const base = {
  BOT_TOKEN: 'token',
  ENCRYPTION_KEY: Buffer.from('12345678901234567890123456789012').toString(
    'base64'
  )
}

test('defaults to gramjs outside test mode', () => {
  assert.equal(loadEnv(base).telegramAdapter, 'gramjs')
})

test('defaults to fake in test mode', () => {
  assert.equal(loadEnv({ ...base, NODE_ENV: 'test' }).telegramAdapter, 'fake')
})
