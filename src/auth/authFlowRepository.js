const AUTH_TTL_MINUTES = 10

function mapFlow(row) {
  if (!row) return null
  return {
    id: row.id,
    userId: row.user_id,
    chatId: row.chat_id,
    currentStep: row.current_step,
    transientMetadata: row.transient_metadata || {},
    expiresAt: row.expires_at,
    completedAt: row.completed_at,
    cancelledAt: row.cancelled_at
  }
}

async function startFlow(pool, userId, chatId, currentStep = 'api_id') {
  await cancelActiveFlow(pool, userId)

  const result = await pool.query(
    `
      insert into auth_flows(user_id, chat_id, current_step, expires_at)
      values($1, $2, $3, now() + ($4 || ' minutes')::interval)
      returning *
    `,
    [userId, chatId, currentStep, AUTH_TTL_MINUTES]
  )

  return mapFlow(result.rows[0])
}

async function getActiveFlow(pool, userId) {
  const result = await pool.query(
    `
      select *
      from auth_flows
      where user_id = $1
        and completed_at is null
        and cancelled_at is null
        and expires_at > now()
      order by created_at desc
      limit 1
    `,
    [userId]
  )
  return mapFlow(result.rows[0])
}

async function updateFlow(pool, flowId, currentStep, transientMetadata = {}) {
  const result = await pool.query(
    `
      update auth_flows
      set current_step = $2,
          transient_metadata = $3,
          expires_at = now() + ($4 || ' minutes')::interval,
          updated_at = now()
      where id = $1
      returning *
    `,
    [flowId, currentStep, JSON.stringify(transientMetadata), AUTH_TTL_MINUTES]
  )
  return mapFlow(result.rows[0])
}

async function completeFlow(pool, flowId) {
  await pool.query(
    'update auth_flows set completed_at = now(), updated_at = now() where id = $1',
    [flowId]
  )
}

async function cancelActiveFlow(pool, userId) {
  await pool.query(
    `
      update auth_flows
      set cancelled_at = now(), updated_at = now()
      where user_id = $1
        and completed_at is null
        and cancelled_at is null
    `,
    [userId]
  )
}

async function purgeExpiredFlows(pool) {
  await pool.query(
    `
      delete from auth_flows
      where expires_at < now()
         or completed_at < now() - interval '1 hour'
         or cancelled_at < now() - interval '1 hour'
    `
  )
}

module.exports = {
  AUTH_TTL_MINUTES,
  startFlow,
  getActiveFlow,
  updateFlow,
  completeFlow,
  cancelActiveFlow,
  purgeExpiredFlows
}
