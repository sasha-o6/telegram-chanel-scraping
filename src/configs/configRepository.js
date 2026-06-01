const ALLOWED_FIELDS = new Set([
  'isEnable',
  'days',
  'limit',
  'intervalMinutes',
  'channelToSend',
  'channels',
  'keywords',
  'keywords2',
  'banWords'
])

const COLUMN_MAP = {
  isEnable: 'is_enable',
  days: 'days',
  limit: 'limit_count',
  intervalMinutes: 'interval_minutes',
  channelToSend: 'channel_to_send',
  channels: 'channels',
  keywords: 'keywords',
  keywords2: 'keywords2',
  banWords: 'ban_words'
}

function validatePatch(patch) {
  const entries = Object.entries(patch).filter(
    ([, value]) => value !== undefined
  )
  for (const [key] of entries) {
    if (!ALLOWED_FIELDS.has(key))
      throw new Error(`Unsupported config field: ${key}`)
  }

  if (patch.intervalMinutes != null && Number(patch.intervalMinutes) < 20) {
    throw new Error('intervalMinutes must be at least 20')
  }

  return entries
}

function mapRow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    telegramUserId: row.telegram_user_id,
    isEnable: row.is_enable,
    days: row.days,
    limit: row.limit_count,
    intervalMinutes: row.interval_minutes,
    channelToSend: row.channel_to_send,
    channels: row.channels,
    keywords: row.keywords,
    keywords2: row.keywords2,
    banWords: row.ban_words,
    lastScrapedAt: row.last_scraped_at,
    lockedAt: row.locked_at
  }
}

async function ensureConfig(pool, userId) {
  const result = await pool.query(
    `
      insert into scraper_configs(user_id)
      values($1)
      on conflict(user_id) do update set updated_at = now()
      returning *
    `,
    [userId]
  )

  return mapRow(result.rows[0])
}

async function getConfig(pool, userId) {
  const result = await pool.query(
    'select * from scraper_configs where user_id = $1',
    [userId]
  )
  return mapRow(result.rows[0])
}

async function updateConfig(pool, userId, patch) {
  await ensureConfig(pool, userId)
  const entries = validatePatch(patch)
  if (entries.length === 0) return getConfig(pool, userId)

  const assignments = entries.map(
    ([key], index) => `${COLUMN_MAP[key]} = $${index + 2}`
  )
  const values = entries.map(([, value]) =>
    Array.isArray(value) ? JSON.stringify(value) : value
  )

  const result = await pool.query(
    `
      update scraper_configs
      set ${assignments.join(', ')}, updated_at = now()
      where user_id = $1
      returning *
    `,
    [userId, ...values]
  )

  return mapRow(result.rows[0])
}

async function deleteConfig(pool, userId) {
  await pool.query('delete from scraper_configs where user_id = $1', [userId])
}

async function listDueConfigs(pool, now = new Date()) {
  const result = await pool.query(
    `
      select c.*,
             u.telegram_user_id,
             s.encrypted_api_id,
             s.encrypted_api_hash,
             s.encrypted_string_session,
             s.session_status
      from scraper_configs c
      join bot_users u on u.id = c.user_id
      left join telegram_secrets s on s.user_id = c.user_id
      where c.is_enable = true
        and (c.locked_at is null or c.locked_at < $1::timestamptz - interval '2 hours')
        and (c.last_scraped_at is null or c.last_scraped_at <= $1::timestamptz - (c.interval_minutes || ' minutes')::interval)
    `,
    [now.toISOString()]
  )

  return result.rows.map(row => ({
    ...mapRow({
      ...row,
      telegram_user_id: row.telegram_user_id
    }),
    encryptedApiId: row.encrypted_api_id,
    encryptedApiHash: row.encrypted_api_hash,
    encryptedStringSession: row.encrypted_string_session,
    sessionStatus: row.session_status
  }))
}

async function lockConfig(pool, configId) {
  const result = await pool.query(
    `
      update scraper_configs
      set locked_at = now()
      where id = $1
        and (locked_at is null or locked_at < now() - interval '2 hours')
      returning *
    `,
    [configId]
  )
  return result.rowCount === 1
}

async function finishConfigRun(pool, configId, now = new Date()) {
  await pool.query(
    `
      update scraper_configs
      set last_scraped_at = $2, locked_at = null, updated_at = now()
      where id = $1
    `,
    [configId, now.toISOString()]
  )
}

module.exports = {
  ALLOWED_FIELDS,
  validatePatch,
  ensureConfig,
  getConfig,
  updateConfig,
  deleteConfig,
  listDueConfigs,
  lockConfig,
  finishConfigRun
}
