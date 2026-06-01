const test = require('node:test')
const assert = require('node:assert/strict')
const { assertPrivateChat } = require('../src/auth/authFlow')

test('allows private chat authorization', () => {
  assert.doesNotThrow(() => assertPrivateChat({ chat: { type: 'private' } }))
})

test('rejects group authorization', () => {
  assert.throws(
    () => assertPrivateChat({ chat: { type: 'group' } }),
    /private bot chats/
  )
})
