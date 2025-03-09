const { setTimeout: delay } = require('timers/promises')
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
const {
  createChanelLinkId,
  getTextAfterLinkLabel,
  writeToFile,
  getId,
  createLink,
  filterMessages,
  getAllChanelMePostLinks,
  guessChatType
} = require('./utils')

const stringSession = new StringSession(stringSessionSTR)

const appMain = async () => {
  const client = new TelegramClient(stringSession, apiId, apiHash, {
    connectionRetries: 5
  })

  if (stringSession._key) {
    await client.connect()
  } else {
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

  const messagesMeChanelPostLink = await getAllChanelMePostLinks(client)

  for (const channel of channels) {
    try {
      console.log(`\n--- Перевіряємо канал/чат: ${channel} ---`)

      const result = await client.getMessages(channel, { limit })

      console.log('Результат збережено у файл result.json'.green.bold)

      const resultTransform = result
        .map(obj => {
          const obgMessage = obj.message

          if (obgMessage != undefined && obgMessage != '')
            return {
              id: obj.id,
              date: obj.date,
              message: obgMessage,
              postLink: `https://t.me/${createChanelLinkId(channel)}/${obj.id}`,
              channelTitle: obj?.action?.title ?? '',
              obj
            }
        })
        .filter(obj => obj != undefined)

      if (!result)
        console.log(
          `Не вдалося отримати повідомлення з каналу/чату: ${channel}`.red
        )

      // Якщо є повідомлення, що підходять — пересилаємо їх у "Saved Messages"
      for (const msg of filterMessages(resultTransform)) {
        if (
          !messagesMeChanelPostLink.includes(msg.postLink) &&
          nodeEnv == 'prod'
        ) {
          await client
            .sendMessage(channelToSend, {
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
            .catch(
              async err => {
                if (err.errorMessage == 'FLOOD') {
                  console.log(
                    `Please weate ${err.seconds * 1000} secconds`.bold.yellow
                  ) && (await delay(err.seconds * 1000))
                }
              }

              // (await setTimeout(err.seconds * 1000, () => {
              //   console.log(`Finnaly !`.bold.green)
              // }))
            )
        }

        if (nodeEnv != 'prod') {
          console.log('msg: ', msg)
        }

        if (
          msg.obj?.replies?.replies > 0 &&
          msg.obj?.replies?.comments == true
        ) {
          const repliesMessages = await client.getMessages(
            getId(`https://t.me/c/${msg.obj.replies.channelId}`).chatId,
            { limit }
          )

          await filterMessages(repliesMessages).forEach(async replie => {
            const replieLink = createLink(
              msg.obj.replies.channelId + '',
              replie.id,
              'channel'
            ).tMeLink

            if (
              !messagesMeChanelPostLink.includes(replieLink.postLink) &&
              nodeEnv == 'prod'
            ) {
              await client
                .sendMessage(channelToSend, {
                  message:
                    `**Канал/чат:** ${msg.channelTitle ?? channel}\n` +
                    `**Дата:** ${new Date(replie.date * 1000).toLocaleString()}\n` +
                    `**Повідомлення:**\n\n` +
                    replie.message +
                    `\n\n\n` +
                    `**Ключові слова:*** \n` +
                    msg.keyWords[0].join(', ') +
                    '    ___    ' +
                    msg.keyWords[1].join(', ') +
                    `\n` +
                    `**Ключові слова коментаря:*** \n` +
                    replie.keyWords[0].join(', ') +
                    '    ___    ' +
                    replie.keyWords[1].join(', ') +
                    `\n` +
                    `**Посилання на коментар:** \n` +
                    +`\n` +
                    `**Посилання:** \n` +
                    msg.postLink
                })
                .catch(
                  async err => {
                    if (err.errorMessage == 'FLOOD') {
                      console.log(
                        `Please weate ${err.seconds * 1000} secconds`.bold
                          .yellow
                      ) && (await delay(err.seconds * 1000))
                    }
                  }
                  // (await setTimeout(err.seconds * 1000, () => {
                  //   console.log(`Finnaly !`.bold.green)
                  // }))
                )
            }
          })
        }
      }
    } catch (err) {
      console.error(`Помилка обробки:`.bold.red, err)
    }
  }

  console.log('\nПеревірка завершена!'.bold.green)
  await client.disconnect()
}

// function delay(ms) {
//   return new Promise(resolve => setTimeout(resolve, ms))
// }

appMain()

const minutes = 20

setInterval(
  async () => {
    console.log('\n\n--- Запускаємо наступну перевірку ---')
    await appMain()
  },
  minutes * 60 * 1000
)
