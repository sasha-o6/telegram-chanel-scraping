const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')

test('migration defines one-config, one-secret, auth-flow, and outbox invariants', () => {
  const sql = fs.readFileSync('migrations/001_init.sql', 'utf8')

  assert.match(sql, /unique\(user_id\)/)
  assert.match(sql, /auth_flows_one_active_per_user/)
  assert.match(sql, /delivery_outbox/)
  assert.match(sql, /destination_chat text not null/)
})

test('due config query selects Telegram user id and lock update reclaims stale locks', () => {
  const source = fs.readFileSync('src/configs/configRepository.js', 'utf8')

  assert.match(source, /u\.telegram_user_id/)
  assert.match(source, /locked_at < now\(\) - interval '2 hours'/)
})

test('transactional helpers use pinned pool clients', () => {
  const migrate = fs.readFileSync('src/db/migrate.js', 'utf8')
  const delivery = fs.readFileSync('src/delivery/deliveryRepository.js', 'utf8')

  assert.match(migrate, /const client = await pool\.connect\(\)/)
  assert.match(delivery, /const client = await pool\.connect\(\)/)
})
