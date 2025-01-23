const { TelegramClient } = require('telegram')
const { StringSession } = require('telegram/sessions')
const input = require('input')
const colors = require('colors')

const {
  days,
  channelToSend,
  apiId,
  apiHash,
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
      phoneNumber: async () => await input.text('Введіть ваш номер телефону: '),
      password: async () =>
        await input.text('Введіть ваш пароль (якщо є 2FA): '),
      phoneCode: async () => await input.text('Введіть код із SMS/Telegram: '),
      onError: err => console.log(err)
    })
  }

  console.log('Авторизація пройшла успішно!'.green.bold)
  console.log('Поточна сесія:', client.session.save())
  // Можна зберегти client.session.save() у .env чи інший файл, щоб не вводити код кожного разу

  // Приклад: вибираємо повідомлення за останні X годин/днів
  // Задаємо проміжок часу (наприклад, 24 години тому)
  const now = new Date()
  const timeBoundary = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

  // Отримати ідентифікатор "Saved Messages" (наш власний "чат із собою")
  // Всі користувачі можуть звертатися до нього як до "me" або "self"
  const me = await client.getMe()
  // Для пересилання в Saved Messages потрібен "peer", який відповідає саме нашому акаунту
  // У GramJS достатньо використати 'me' в методах надіслання повідомлення / форварду.

  for (const channel of channels) {
    try {
      console.log(`\n--- Перевіряємо канал/чат: ${channel} ---`)
      // Фетчимо останні N повідомлень (наприклад, 50).
      // Якщо канал дуже активний, можна фільтрувати за датами, пагінацію і т.д.
      // У GramJS немає прямого "дата від - дата до", але можна вибирати за повідомленнями з пагінацією і вручну фільтрувати.

      const limit = 50
      const result = await client.getMessages(channel, { limit })

      const resultTransform = result
        .map(obj => {
          const obgMessage = obj.message
          const channelLinkId = (channel + '')
            .replace('', '')
            .replace('-100', 'c/')

          if (obgMessage != undefined && obgMessage != '')
            return {
              id: obj.id,
              date: obj.date,
              message: obgMessage,
              postLink: `https://t.me/${channelLinkId}/${obj.id}`,
              channelTitle: obj?.action?.title ?? ''
            }
        })
        .filter(obj => obj != undefined)

      if (!result) {
        console.log(
          `Не вдалося отримати повідомлення з каналу/чату: ${channel}`.red
        )
        continue
      }

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
      }
    } catch (err) {
      console.error(`Помилка обробки:`.bold.red, err)
    }
  }

  console.log('\nПеревірка завершена!'.bold.green)
  // Можна викликати client.disconnect(), якщо більше нічого не робимо
  await client.disconnect()
}

appMain()
