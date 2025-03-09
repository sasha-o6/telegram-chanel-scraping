const fs = require('fs') // Додано модуль для роботи з файлами

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

const now = new Date()
const timeBoundary = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)

const createChanelLinkId = channel =>
  (channel + '').replace('', '').replace('-100', 'c/')

function getTextAfterLinkLabel(text, keyWord) {
  const parts = text.replaceAll('\n', '').split(keyWord)
  if (parts.length < 2) return ''

  return parts.slice(1).join('').trim()
}

const writeToFile = date => {
  fs.writeFileSync('./result.json', JSON.stringify(date, null, 2), 'utf-8')
}

function getId(url) {
  // Створимо кілька шаблонів (регулярних виразів) для різних форматів посилань
  // 1) web.telegram.org/...#-100123456_789
  // 2) t.me/c/123456789/234
  // 3) t.me/username/123
  // 4) t.me/username (без ID)
  // 5) інші варіації.

  // У підсумку хочемо отримати:
  // - chatId: ідентифікатор каналу/чату ("-100123456789", "123456789", "username", ...)
  // - messageId: якщо в посиланні є конкретне повідомлення (число після "/")
  // - chatType: евристична оцінка типу ("channel" / "group" / "username" / "unknown")

  const result = {
    chatId: null,
    messageId: null,
    chatType: 'unknown' // Спробуємо визначити нижче
  }

  if (!url) {
    return result
  }

  // 1) Формат web.telegram.org/...#-100xxxxxx(_yyy)
  //    Напр.: "https://web.telegram.org/k/#-1002214543625_115"
  //    Група 1: -1002214543625  Група 2: 115
  let match = url.match(/web\.telegram\.org\/[a-zA-Z]\/#(-?\d+)(?:_(\d+))?/)
  if (match) {
    result.chatId = match[1]
    if (match[2]) {
      result.messageId = match[2]
    }
    // Визначаємо chatType
    result.chatType = guessChatType(result.chatId)
    return result
  }

  // 2) Формат t.me/c/123456789/234
  //    Група 1: 123456789  Група 2: 234
  match = url.match(/t\.me\/c\/(\d+)(?:\/(\d+))?/)
  if (match) {
    // Додаємо -100 попереду, бо в Bot API канали йдуть із таким префіксом
    result.chatId = '-100' + match[1]
    if (match[2]) {
      result.messageId = match[2]
    }
    result.chatType = guessChatType(result.chatId)
    return result
  }

  // 3) Формат t.me/username/123
  //    Група 1: username,  Група 2: 123
  match = url.match(/t\.me\/([A-Za-z0-9_]+)(?:\/(\d+))?/)
  if (match) {
    result.chatId = match[1]
    if (match[2]) {
      result.messageId = match[2]
    }
    result.chatType = guessChatType(result.chatId)
    return result
  }

  // 4) Спробуємо знайти -100xxxxxx.
  match = url.match(/(-100\d+)/)
  if (match) {
    result.chatId = match[1]
    // Спробуємо знайти повідомлення, якщо є (_123)
    let m2 = url.match(/-100\d+_(\d+)/)
    if (m2) {
      result.messageId = m2[1]
    }
    result.chatType = guessChatType(result.chatId)
    return result
  }

  // Якщо нічого не знайшли, повертаємо result.
  return result
}

// Додамо допоміжну функцію для евристичного визначення типу
function guessChatType(chatId) {
  // Якщо починається з "-100", припустимо, що це супергрупа або канал.
  if (typeof chatId === 'string' && chatId.startsWith('-100')) {
    return 'channel' // або "supergroup"
  }
  // Якщо numeric (починається з "-") – може бути стара група чи приватний чат.
  if (/^-?\d+$/.test(chatId)) {
    // Якщо від'ємне, але не -100
    // це може бути "group" чи інший тип.
    return 'group'
  }
  // Якщо це комбінація букв/цифр (username)
  // теоретично може бути public group або public channel або user.
  // Точного способу відрізнити немає — назвемо "username".
  return 'username'
}

/**
 * Створює 2 посилання для каналу/групи/юзернейму за заданими id, messageId та chatType.
 *
 * @param {string} id        - Ідентифікатор (наприклад, '-1002214543625' або 'landing_des')
 * @param {string|null} messageId - Номер повідомлення (якщо є), інакше null
 * @param {string} chatType  - 'channel' | 'group' | 'username' | 'unknown'
 * @returns {{
 *   webLink: string|null,
 *   tMeLink: string|null
 * }}
 */
function createLink(id, messageId, chatType) {
  let webLink = null // https://web.telegram.org/k/#...
  let tMeLink = null // https://t.me/c/...  або щось інше

  switch (chatType) {
    case 'channel':
      // Припускаємо, що id = '-100xxxxxx'
      // 1) webLink:
      //    якщо messageId є: https://web.telegram.org/k/#-100xxxxxx_messageId
      //    якщо немає:       https://web.telegram.org/k/#-100xxxxxx
      webLink = `https://web.telegram.org/k/#${id}`
      if (messageId) {
        webLink += `_${messageId}`
      }

      // 2) tMeLink:
      //    https://t.me/c/xxxxxx/messageId
      //    Для /c/ ... треба прибрати '-100'
      //    Якщо messageId немає, буде без /messageId
      const pureId = (id + '').replace('-100', '') // видаляємо префікс -100
      tMeLink = `https://t.me/c/${pureId}`
      if (messageId) {
        tMeLink += `/${messageId}`
      }

      break

    case 'group':
      // Зазвичай група може мати ID -123456, але без -100.
      // Web-формат: https://web.telegram.org/k/#-123456[_msgId]
      // t.me/c/... зазвичай не працює для «класичної» групи,
      // тому або повертаємо null, або спробуємо аналогічно
      // (але не факт, що посилання буде дійсне).
      webLink = `https://web.telegram.org/k/#${id}`
      if (messageId) {
        webLink += `_${messageId}`
      }
      // tMeLink = null, або https://t.me/c/123456/msgId
      // Але класичні групи часто не підтримують /c/.
      // Можна лишити null:
      tMeLink = null
      break

    case 'username':
      // Якщо chatId - це публічний username, web.telegram.org у форматі #username не завжди працює.
      // Але зробимо так:
      // webLink = https://web.telegram.org/k/#@username — експериментально, часто не відкривається.
      webLink = `https://web.telegram.org/k/#@${id}`
      if (messageId) {
        // У web.telegram.org не існує офіційного формату для юзернейма з повідомленням.
        // Можна лише приблизно: #@username_msgId (але це навряд чи працюватиме напряму).
        webLink += `_${messageId}`
      }

      // tMeLink = https://t.me/username[/messageId]
      tMeLink = `https://t.me/${id}`
      if (messageId) {
        tMeLink += `/${messageId}`
      }
      break

    default:
      // unknown
      // Можна нічого не повертати або зібрати хоч якусь конструкцію
      webLink = null
      tMeLink = null
      break
  }

  return { webLink, tMeLink }
}

/**
 * Фільтрує повідомлення
 *
 * @param {messages} Obj
 * @returns { FilteredObj }
 */

const filterMessages = messages => {
  return messages.filter(msg => {
    const msgDate = new Date(msg.date * 1000)
    if (msgDate < timeBoundary) {
      return false
    }

    const text = msg.message?.toLowerCase() || ''

    const foundKeywords = keywords.filter(kw => text.includes(kw.toLowerCase()))
    const foundKeywords2 = keywords2.filter(kw =>
      text.includes(kw.toLowerCase())
    )
    // const foundBanWords = banWords.filter(kw => text.includes(kw.toLowerCase()))

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
}

const getAllChanelMePostLinks = async client => {
  const messagesMeChanel = await client.getMessages(channelToSend, { limit })

  const messagesMeChanelPostLink = messagesMeChanel
    .map(item => {
      if (item?.message && item?.message.length > 0)
        return getTextAfterLinkLabel(item.message, 'Посилання:')
    })
    .filter(item => item?.postLink != '')

  return messagesMeChanelPostLink
}

module.exports = {
  createChanelLinkId,
  getTextAfterLinkLabel,
  writeToFile,
  getId,
  guessChatType,
  createLink,
  filterMessages,
  getAllChanelMePostLinks
}
