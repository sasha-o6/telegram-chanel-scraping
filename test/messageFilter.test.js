const test = require('node:test')
const assert = require('node:assert/strict')
const {
  filterMessage,
  filterMessages
} = require('../src/filtering/messageFilter')

const baseConfig = {
  days: 2,
  keywords: ['робота', 'фриланс'],
  keywords2: [],
  banWords: ['безкоштовно']
}

test('includes messages with a primary keyword and no ban words', () => {
  const result = filterMessage(
    { message: 'Є робота для дизайнера' },
    baseConfig
  )

  assert.equal(result.keyWords[0][0], 'робота')
})

test('excludes messages containing ban words', () => {
  const result = filterMessage({ message: 'робота безкоштовно' }, baseConfig)

  assert.equal(result, null)
})

test('requires keywords2 when configured', () => {
  const config = { ...baseConfig, keywords2: ['дизайн'] }

  assert.equal(filterMessage({ message: 'є робота' }, config), null)
  assert.ok(filterMessage({ message: 'є робота дизайн' }, config))
})

test('filters old messages by configured days', () => {
  const now = new Date('2026-06-01T00:00:00Z')
  const result = filterMessages(
    [
      { date: '2026-05-30T23:00:00Z', message: 'робота', id: 1 },
      { date: '2026-05-20T00:00:00Z', message: 'робота', id: 2 }
    ],
    baseConfig,
    now
  )

  assert.deepEqual(
    result.map(item => item.id),
    [1]
  )
})
