# ТЗ: multi-user Telegram scraper

## Ідея

Додаток збирає релевантні повідомлення з Telegram-груп, каналів і чатів для оперативного пошуку потенційних замовників. Система працює для багатьох користувачів: кожен користувач має власні Telegram-credentials, сесію, джерела, ключові слова і destination chat.

## Контекст

Користувачі мають багато Telegram-джерел, де можуть з'являтися потенційні клієнти або замовлення. Додаток автоматизує моніторинг, фільтрацію і доставку релевантних повідомлень, щоб не перевіряти всі джерела вручну.

## Архітектура

- **Scraper worker**: використовує Telegram user account через TDLib, читає налаштовані джерела і надсилає знайдені повідомлення в `channelToSend`.
- **Telegram bot**: керує реєстрацією користувача, авторизацією Telegram account, CRUD конфігів і notification-повідомленнями.
- **PostgreSQL**: зберігає користувачів, конфіги, encrypted secrets, scraper state і вже надіслані пости.
- **Docker**: додаток і база запускаються через Docker Compose.

## Multi-user модель

- Кожен Telegram bot user бачить і редагує тільки власні конфіги.
- Один користувач має один активний config v1.
- Sensitive fields (`apiId`, `apiHash`, `stringSessionSTR`) зберігаються в БД тільки у зашифрованому вигляді.
- Encryption key задається через environment variable і не зберігається в БД.

## Конфіг користувача

Bot/TMA має дозволяти CRUD тільки для цих полів:

- `isEnable: boolean`
- `days: number`
- `limit: number`
- `intervalMinutes: number` (`>= 20`)
- `channelToSend: 'me' | chatId | botChat`
- `apiId: number`
- `apiHash: string`
- `channels: string[]`
- `keywords: string[]`
- `keywords2: string[]`
- `banWords: string[]`

## Telegram authorization flow

- Якщо `stringSessionSTR` порожній або expired, bot запитує у користувача потрібні дані для авторизації.
- Bot має провести користувача через введення phone number, verification code і 2FA password, якщо він потрібен.
- Після успішної авторизації новий `stringSessionSTR` зберігається у зашифрованому вигляді.
- Якщо scraper під час роботи виявляє expired session, bot надсилає notification-повідомлення з проханням повторити авторизацію.

## Scheduler

- Є один global scheduler, який запускається кожні 20 хвилин.
- На кожному tick scheduler перевіряє enabled configs.
- Кожен користувач має власний `intervalMinutes`.
- Якщо у користувача `intervalMinutes = 60`, scheduler пропускає перші два 20-хвилинні ticks і запускає scraping на третьому.
- Для рішення використовується `last_scraped_at` або еквівалентний persisted state.

## Scraper логіка

Для кожного enabled config:

1. Перевірити наявність `apiId`, `apiHash`, `stringSessionSTR`, `channels`, `keywords` і `channelToSend`.
2. Якщо session порожня або expired, не запускати scraping і повідомити користувача через bot.
3. Прочитати `limit` останніх повідомлень з кожного source за останні `days`.
4. Повідомлення проходить фільтр, якщо містить хоча б одне слово з `keywords`, не містить `banWords`, а якщо `keywords2` не порожній, містить хоча б одне слово з `keywords2`.
5. Не надсилати duplicate posts, які вже були доставлені для цього користувача.
6. Надіслати повідомлення у `channelToSend` за шаблоном нижче.

## Шаблон повідомлення

```js
;`**Канал/чат:** ${msg.channelTitle ?? channel}\n` +
  `**Дата:** ${new Date(msg.date * 1000).toLocaleString()}\n` +
  `**Повідомлення:**\n\n` +
  msg.message +
  `\n\n\n` +
  `**Ключові слова:*** \n` +
  msg.keyWords[0].join(', ') +
  ' ___ ' +
  msg.keyWords[1].join(', ') +
  `\n` +
  `**Посилання:** \n` +
  msg.postLink
```

## Acceptance criteria

- Multi-user isolation: користувач не може читати або редагувати чужі конфіги.
- Config CRUD працює для перелічених полів.
- Sensitive fields encrypted at rest in PostgreSQL.
- Global scheduler запускається кожні 20 хв і поважає per-user `intervalMinutes`.
- Scraper не дублює вже надіслані пости.
- Expired або missing session викликає bot notification і повторний auth flow.
- Джерела v1: групи, канали, чати.

## Non-goals v1

- Коментарі до постів.
- Джерела поза групами, каналами і чатами.
- Платежі, підписки, billing.
- Повноцінний SaaS admin для керування чужими користувачами.
