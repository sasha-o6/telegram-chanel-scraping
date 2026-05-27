const { TelegramClient, MemoryStorage } = require('@mtcute/node')
const input = require('input')
const colors = require('colors')
const {
  nodeEnv,
  days,
  limit,
  channelToSend,
  apiId,
  apiHash,
  stringSessionSTR,
  channels,
  keywords,
  keywords2,
  banWords
} = require('./const')

const appMain = async () => {
  // Ініціалізація клієнта
  const tg = new TelegramClient({
    apiId,
    apiHash,
    storage: new MemoryStorage()
  })

  if (stringSessionSTR) {
    await tg.importSession(stringSessionSTR)
  }

  // Підключаємося та проходимо авторизацію
  await tg.start({
    phone: async () =>
      // phoneNumberMe
      // ? phoneNumberMe
      // :
      await input.text('Введіть ваш номер телефону: '),
    password: async () =>
      await input.text('Введіть ваш пароль (якщо є 2FA): '),
    code: async () =>
      // phoneCodeMe
      //   ? phoneCodeMe
      //   :
      await input.text('Введіть код із SMS/Telegram: '),
  })

  console.log('Авторизація пройшла успішно!'.green.bold)
  console.log('Поточна сесія:', await tg.exportSession())

  const now = new Date()
  const timeBoundary = new Date(now.getTime() - days * 24 * 60 * 60 * 1000); // 20 minutes

  const messagesMeChanel = []
  for await (const msg of tg.iterHistory(channelToSend, { limit })) {
    messagesMeChanel.push(msg)
  }

  const messagesMeChanelPostLink = messagesMeChanel
    .map(item => {
      if (item?.text && item?.text.length > 0)
        return getTextAfterLinkLabel(item.text, 'Посилання:').trim()
    })
    .filter(item => item?.postLink != '')

  for (const channel of channels) {
    try {
      console.log(`\n--- Перевіряємо канал/чат: ${channel} ---`)

      const result = []
      for await (const msg of tg.iterHistory(channel, { limit })) {
        result.push(msg)
      }
      const resultTransform = result
        .map(obj => {
          const obgMessage = obj.text

          if (obgMessage != undefined && obgMessage != '')
            return {
              id: obj.id,
              date: obj.date ? Math.floor(obj.date.getTime() / 1000) : 0,
              message: obgMessage,
              postLink: `https://t.me/${createChanelLinkId(channel)}/${obj.id}`,
              channelTitle: obj?.chat?.title ?? ''
            }
        })
        .filter(obj => obj != undefined)

      if (!result || result.length === 0)
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
          !messagesMeChanelPostLink.includes(msg.postLink.trim()) &&
          nodeEnv == 'prod'
        ) {
          // console.log(
          //   'messagesMeChanelPostLink, msg.postLink: ',
          //   messagesMeChanelPostLink,
          //   msg.postLink
          // )

          await tg.sendText(channelToSend,
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
          )
        }

        if (nodeEnv != 'prod') console.log('msg: ', msg)
      }
    } catch (err) {
      console.error(`Помилка обробки:`.bold.red, err)
    }
  }

  console.log('\nПеревірка завершена!'.bold.green)
  // Можна викликати tg.close(), якщо більше нічого не робимо
  await tg.close()
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

const minutes = 20

// Запускаємо далі з періодом 20 хвилин (20 * 60 * 1000 мс)
setInterval(
  async () => {
    console.log('\n\n--- Запускаємо наступну перевірку ---')
    await appMain()
  },
  minutes * 60 * 1000
)
