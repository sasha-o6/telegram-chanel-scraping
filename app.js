const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')
const input = require('input')
const colors = require('colors')
const {
  nodeEnv,
  days,
  limit,
  channelToSend,
  apiId,
  apiHash,
  phoneNumberMe,
  phoneCodeMe,
  stringSessionSTR,
  channels,
  keywords,
  keywords2,
  banWords
} = require('./const')

const stringSession = new StringSession(stringSessionSTR)

const appMain = async () => {
  // Ініціалізація клієнта

  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5
  })

  if (stringSession._key) {
    await client.connect()
  } else {
    // Підключаємося та проходимо авторизацію
    await client.start({
      phoneNumber: async () =>
        // phoneNumberMe
        // ? phoneNumberMe
        // :
        await input.text('Введіть ваш номер телефону: '),
      password: async () =>
        await input.text('Введіть ваш пароль (якщо є 2FA): '),
      phoneCode: async () =>
        // phoneCodeMe
        //   ? phoneCodeMe
        //   :
        await input.text('Введіть код із SMS/Telegram: '),
      onError: err => console.log(err)
    })
  }

  console.log('Авторизація пройшла успішно!'.green.bold)
  console.log('Поточна сесія:', client.session.save())

  const now = new Date()
  const timeBoundary = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  const messagesMeChanel = await client.getMessages(channelToSend, {
    limit
  })

  const messagesMeChanelPostLink = messagesMeChanel
    .map(item => {
      if (item?.message && item?.message.length > 0)
        return getTextAfterLinkLabel(item.message, 'Посилання:')
    })
    .filter(item => item?.postLink != '')

  for (const channel of channels) {
    try {
      console.log(`\n--- Перевіряємо канал/чат: ${channel} ---`)

      const result = await client.getMessages(channel, { limit })
      const resultTransform = result
        .map(obj => {
          const obgMessage = obj.message

          if (obgMessage != undefined && obgMessage != '')
            return {
              id: obj.id,
              date: obj.date,
              message: obgMessage,
              postLink: `https://t.me/${createChanelLinkId(channel)}/${obj.id}`,
              channelTitle: obj?.action?.title ?? ''
            }
        })
        .filter(obj => obj != undefined)

      if (!result)
        console.log(
          `Не вдалося отримати повідомлення з каналу/чату: ${channel}`.red
        )

      // Фільтруємо повідомлення за датою та ключовими словами
      const filteredMessages = resultTransform.filter(msg => {
        // Перевіримо дату
        const msgDate = new Date(msg.date * 1000)
        if (msgDate < timeBoundary) {
          return false // Пропускаємо, якщо повідомлення давніше за нашу межу
        }

        // Перевіримо текст на наявність ключових слів
        const text = msg.message?.toLowerCase() || ''

        // Знайдемо, які саме слова з кожного списку є в повідомленні
        const foundKeywords = keywords.filter(kw =>
          text.includes(kw.toLowerCase())
        )
        const foundKeywords2 = keywords2.filter(kw =>
          text.includes(kw.toLowerCase())
        )
        const foundBanWords = banWords.filter(kw =>
          text.includes(kw.toLowerCase())
        )

        msg.keyWords = [foundKeywords, foundKeywords2]

        if (
          keywords.some(kw => text.includes(kw.toLowerCase())) &&
          keywords2.length > 0 &&
          keywords2.some(kw => text.includes(kw.toLowerCase())) &&
          !banWords.some(kw => text.includes(kw.toLowerCase()))
        ) {
          return msg
        }
      })

      // Якщо є повідомлення, що підходять — пересилаємо їх у "Saved Messages"
      for (const msg of filteredMessages) {
        if (
          !messagesMeChanelPostLink.includes(msg.postLink) &&
          nodeEnv == 'prod'
        )
          await client.sendMessage(channelToSend, {
            message:
              `**Канал/чат:** ${msg.channelTitle ?? channel}\n` +
              `**Дата:** ${new Date(msg.date * 1000).toLocaleString()}\n` +
              `**Повідомлення:**\n\n` +
              msg.message +
              `\n\n\n` +
              `**Ключові слова:*** \n` +
              msg.keyWords[0].join(', ') +
              '    ___    ' +
              msg.keyWords[1].join(', ') +
              `\n` +
              `**Посилання:** \n` +
              msg.postLink
          })

        if (nodeEnv != 'prod') console.log('msg: ', msg)
      }
    } catch (err) {
      console.error(`Помилка обробки:`.bold.red, err)
    }
  }

  console.log('\nПеревірка завершена!'.bold.green)
  // Можна викликати client.disconnect(), якщо більше нічого не робимо
  await client.disconnect()
}

const createChanelLinkId = channel =>
  (channel + '').replace('', '').replace('-100', 'c/')

function getTextAfterLinkLabel(text, keyWord) {
  const parts = text.replaceAll('\n', '').split(keyWord)
  if (parts.length < 2) return ''

  // Частина після "Посилання:" — це parts[1] (і все, що далі, якщо split має більше елементів)
  return parts.slice(1).join('').trim()
}

appMain()
