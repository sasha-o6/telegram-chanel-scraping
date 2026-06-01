const crypto = require('crypto')

const ALGORITHM = 'aes-256-gcm'
const IV_BYTES = 12

function normalizeKey(input) {
  if (!input) throw new Error('ENCRYPTION_KEY is required')

  const decoded = Buffer.from(input, 'base64')
  if (decoded.length === 32) return decoded

  const raw = Buffer.from(input)
  if (raw.length === 32) return raw

  throw new Error('ENCRYPTION_KEY must be 32 bytes or base64-encoded 32 bytes')
}

function createSecretBox(keyInput) {
  const key = normalizeKey(keyInput)

  return {
    encrypt(value) {
      if (value == null) return null

      const iv = crypto.randomBytes(IV_BYTES)
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv)
      const encrypted = Buffer.concat([
        cipher.update(String(value), 'utf8'),
        cipher.final()
      ])
      const tag = cipher.getAuthTag()

      return [iv, tag, encrypted].map(part => part.toString('base64')).join(':')
    },

    decrypt(payload) {
      if (payload == null) return null

      const [ivRaw, tagRaw, encryptedRaw] = String(payload).split(':')
      if (!ivRaw || !tagRaw || !encryptedRaw) {
        throw new Error('Encrypted secret has invalid format')
      }

      const decipher = crypto.createDecipheriv(
        ALGORITHM,
        key,
        Buffer.from(ivRaw, 'base64')
      )
      decipher.setAuthTag(Buffer.from(tagRaw, 'base64'))

      return Buffer.concat([
        decipher.update(Buffer.from(encryptedRaw, 'base64')),
        decipher.final()
      ]).toString('utf8')
    }
  }
}

module.exports = {
  createSecretBox,
  normalizeKey
}
