async function upsertBotUser(pool, telegramUser) {
  const result = await pool.query(
    `
      insert into bot_users(telegram_user_id, username, first_name, updated_at)
      values($1, $2, $3, now())
      on conflict(telegram_user_id)
      do update set username = excluded.username,
                    first_name = excluded.first_name,
                    updated_at = now()
      returning *
    `,
    [
      telegramUser.id,
      telegramUser.username || null,
      telegramUser.first_name || null
    ]
  )

  return result.rows[0]
}

async function findByTelegramUserId(pool, telegramUserId) {
  const result = await pool.query(
    'select * from bot_users where telegram_user_id = $1',
    [telegramUserId]
  )
  return result.rows[0] || null
}

module.exports = {
  upsertBotUser,
  findByTelegramUserId
}
