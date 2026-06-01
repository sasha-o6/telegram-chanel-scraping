const { createSecretBox } = require('../crypto/secrets')
const {
  startFlow,
  getActiveFlow,
  updateFlow,
  completeFlow,
  cancelActiveFlow
} = require('./authFlowRepository')
const { upsertSecrets } = require('../secrets/telegramSecretRepository')

const PRIVATE_CHAT = 'private'

function assertPrivateChat(update) {
  if (update.chat?.type !== PRIVATE_CHAT) {
    throw new Error('Authorization is allowed only in private bot chats')
  }
}

async function beginAuthorization(pool, user, update) {
  assertPrivateChat(update)
  return startFlow(pool, user.id, update.chat.id)
}

async function cancelAuthorization(pool, user) {
  await cancelActiveFlow(pool, user.id)
}

async function handleAuthorizationInput({
  pool,
  encryptionKey,
  telegramClient,
  user,
  update
}) {
  assertPrivateChat(update)
  const flow = await getActiveFlow(pool, user.id)
  if (!flow) return null

  const text = String(update.text || '').trim()
  const metadata = { ...flow.transientMetadata }

  if (flow.currentStep === 'api_id') {
    const apiId = Number(text)
    if (!Number.isFinite(apiId)) throw new Error('apiId must be a number')
    metadata.apiId = apiId
    return updateFlow(pool, flow.id, 'api_hash', metadata)
  }

  if (flow.currentStep === 'api_hash') {
    metadata.apiHash = text
    return updateFlow(pool, flow.id, 'phone', metadata)
  }

  if (flow.currentStep === 'phone') {
    metadata.phone = text
    if (typeof telegramClient.finishAuthorization === 'function') {
      return updateFlow(pool, flow.id, 'code', metadata)
    }

    const nextStep = await telegramClient.startAuthorization({
      apiId: metadata.apiId,
      apiHash: metadata.apiHash,
      phoneNumber: text
    })
    return updateFlow(pool, flow.id, nextStep || 'code', metadata)
  }

  if (flow.currentStep === 'code') {
    if (typeof telegramClient.finishAuthorization === 'function') {
      metadata.authCode = text
      try {
        const result = await telegramClient.finishAuthorization({
          apiId: metadata.apiId,
          apiHash: metadata.apiHash,
          phoneNumber: metadata.phone,
          code: text
        })
        return finishAuthorization(
          pool,
          encryptionKey,
          user.id,
          flow.id,
          metadata,
          result
        )
      } catch (err) {
        if (/password|2fa/i.test(err.message || '')) {
          return updateFlow(pool, flow.id, 'password', metadata)
        }
        throw err
      }
    }

    const result = await telegramClient.submitCode({ code: text })
    if (result?.nextStep === 'password') {
      return updateFlow(pool, flow.id, 'password', metadata)
    }
    return finishAuthorization(
      pool,
      encryptionKey,
      user.id,
      flow.id,
      metadata,
      result
    )
  }

  if (flow.currentStep === 'password') {
    if (typeof telegramClient.finishAuthorization === 'function') {
      const result = await telegramClient.finishAuthorization({
        apiId: metadata.apiId,
        apiHash: metadata.apiHash,
        phoneNumber: metadata.phone,
        code: metadata.authCode,
        password: text
      })
      return finishAuthorization(
        pool,
        encryptionKey,
        user.id,
        flow.id,
        metadata,
        result
      )
    }

    const result = await telegramClient.submitPassword({ password: text })
    return finishAuthorization(
      pool,
      encryptionKey,
      user.id,
      flow.id,
      metadata,
      result
    )
  }

  throw new Error(`Unsupported auth step: ${flow.currentStep}`)
}

async function finishAuthorization(
  pool,
  encryptionKey,
  userId,
  flowId,
  metadata,
  result
) {
  if (!result?.stringSession) {
    throw new Error('Telegram authorization did not return a session')
  }

  const secretBox = createSecretBox(encryptionKey)
  await upsertSecrets(pool, secretBox, userId, {
    apiId: metadata.apiId,
    apiHash: metadata.apiHash,
    stringSession: result.stringSession,
    sessionStatus: 'active'
  })
  await completeFlow(pool, flowId)
  return { currentStep: 'complete' }
}

module.exports = {
  assertPrivateChat,
  beginAuthorization,
  cancelAuthorization,
  handleAuthorizationInput
}
