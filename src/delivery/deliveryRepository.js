async function enqueueDelivery(pool, delivery) {
  const result = await pool.query(
    `
      insert into delivery_outbox(
        user_id,
        config_id,
        source_id,
        message_id,
        post_link,
        destination_chat,
        formatted_message
      )
      values($1, $2, $3, $4, $5, $6, $7)
      on conflict(user_id, config_id, source_id, message_id) do nothing
      returning *
    `,
    [
      delivery.userId,
      delivery.configId,
      delivery.sourceId,
      String(delivery.messageId),
      delivery.postLink,
      delivery.destinationChat,
      delivery.formattedMessage
    ]
  )

  return result.rows[0] || null
}

async function listPendingDeliveries(pool, limit = 50) {
  const result = await pool.query(
    `
      select o.*,
             s.encrypted_api_id,
             s.encrypted_api_hash,
             s.encrypted_string_session
      from delivery_outbox o
      join telegram_secrets s on s.user_id = o.user_id
      where o.status = 'pending'
      order by o.created_at asc
      limit $1
    `,
    [limit]
  )
  return result.rows
}

async function markDeliverySent(pool, delivery) {
  const client = await pool.connect()
  try {
    await client.query('begin')
    await client.query(
      `
        insert into delivered_posts(user_id, config_id, source_id, message_id, post_link)
        values($1, $2, $3, $4, $5)
        on conflict(user_id, config_id, source_id, message_id) do nothing
      `,
      [
        delivery.user_id,
        delivery.config_id,
        delivery.source_id,
        delivery.message_id,
        delivery.post_link
      ]
    )
    await client.query(
      `
        update delivery_outbox
        set status = 'sent', updated_at = now()
        where id = $1
      `,
      [delivery.id]
    )
    await client.query('commit')
  } catch (err) {
    await client.query('rollback')
    throw err
  } finally {
    client.release()
  }
}

async function markDeliveryFailed(pool, deliveryId, err) {
  await pool.query(
    `
      update delivery_outbox
      set attempts = attempts + 1,
          last_error = $2,
          updated_at = now()
      where id = $1
    `,
    [deliveryId, err.message]
  )
}

module.exports = {
  enqueueDelivery,
  listPendingDeliveries,
  markDeliverySent,
  markDeliveryFailed
}
