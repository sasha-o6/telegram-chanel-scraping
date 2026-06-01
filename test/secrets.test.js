const test = require('node:test')
const assert = require('node:assert/strict')
const { createSecretBox } = require('../src/crypto/secrets')

const key = Buffer.from('12345678901234567890123456789012').toString('base64')

test('encrypts and decrypts a secret', () => {
  const box = createSecretBox(key)
  const encrypted = box.encrypt('secret-value')

  assert.notEqual(encrypted, 'secret-value')
  assert.equal(box.decrypt(encrypted), 'secret-value')
})

test('uses a random iv for each encryption', () => {
  const box = createSecretBox(key)

  assert.notEqual(box.encrypt('same'), box.encrypt('same'))
})

test('rejects tampered ciphertext', () => {
  const box = createSecretBox(key)
  const encrypted = box.encrypt('secret-value')
  const tampered = encrypted.replace(/.$/, encrypted.at(-1) === 'A' ? 'B' : 'A')

  assert.throws(() => box.decrypt(tampered))
})
