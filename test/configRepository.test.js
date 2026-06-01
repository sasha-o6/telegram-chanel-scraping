const test = require('node:test')
const assert = require('node:assert/strict')
const { validatePatch } = require('../src/configs/configRepository')

test('rejects unsupported config fields', () => {
  assert.throws(
    () => validatePatch({ role: 'admin' }),
    /Unsupported config field/
  )
})

test('rejects intervals below 20 minutes', () => {
  assert.throws(() => validatePatch({ intervalMinutes: 10 }), /at least 20/)
})

test('accepts allowed fields', () => {
  assert.deepEqual(validatePatch({ keywords: ['робота'] }), [
    ['keywords', ['робота']]
  ])
})
