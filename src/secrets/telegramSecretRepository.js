function mapSecrets(row, secretBox) {
  if (!row) return null

  return {
    userId: row.user_id,
    apiId: row.encrypted_api_id
      ? Number(secretBox.decrypt(row.encrypted_api_id))
      : null,
    apiHash: secretBox.decrypt(row.encrypted_api_hash),
    stringSession: secretBox.decrypt(row.encrypted_string_session),
    sessionStatus: row.session_status
  }
}

async function upsertSecrets(pool, secretBox, userId, patch) {
  const encryptedApiId =
    patch.apiId === undefined ? null : secretBox.encrypt(String(patch.apiId))
  const encryptedApiHash =
    patch.apiHash === undefined ? null : secretBox.encrypt(patch.apiHash)
  const encryptedStringSession =
    patch.stringSession === undefined
      ? null
      : secretBox.encrypt(patch.stringSession)

  const result = await pool.query(
    `
      insert into telegram_secrets(
        user_id,
        encrypted_api_id,
        encrypted_api_hash,
        encrypted_string_session,
        session_status,
        updated_at
      )
      values($1, $2, $3, $4, $5, now())
      on conflict(user_id)
      do update set
        encrypted_api_id = coalesce(excluded.encrypted_api_id, telegram_secrets.encrypted_api_id),
        encrypted_api_hash = coalesce(excluded.encrypted_api_hash, telegram_secrets.encrypted_api_hash),
        encrypted_string_session = coalesce(excluded.encrypted_string_session, telegram_secrets.encrypted_string_session),
        session_status = excluded.session_status,
        updated_at = now()
      returning *
    `,
    [
      userId,
      encryptedApiId,
      encryptedApiHash,
      encryptedStringSession,
      patch.sessionStatus || 'missing'
    ]
  )

  return mapSecrets(result.rows[0], secretBox)
}

async function getSecrets(pool, secretBox, userId) {
  const result = await pool.query(
    'select * from telegram_secrets where user_id = $1',
    [userId]
  )
  return mapSecrets(result.rows[0], secretBox)
}

async function markSessionStatus(pool, userId, status) {
  await pool.query(
    `
      insert into telegram_secrets(user_id, session_status, updated_at)
      values($1, $2, now())
      on conflict(user_id)
      do update set session_status = excluded.session_status,
                    updated_at = now()
    `,
    [userId, status]
  )
}

module.exports = {
  upsertSecrets,
  getSecrets,
  markSessionStatus
}
