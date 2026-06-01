# Документація проєкту `telegram-chanel-scraping`

## Призначення

Проєкт є multi-user Telegram scraper. Він працює через Telegram bot, приймає персональні налаштування від кожного користувача, авторизує його Telegram user account, читає налаштовані групи, канали й чати, фільтрує повідомлення та доставляє релевантні пости у вибраний destination chat.

Основний сценарій: автоматичний пошук потенційних замовлень, фриланс-запитів або інших релевантних повідомлень у Telegram-джерелах без ручного моніторингу кожного чату.

## Поточна архітектура

- `app.js` стартує застосунок, Telegram bot, PostgreSQL pool і global scheduler.
- `src/bot/` обробляє Telegram Bot API polling, команди користувача, config CRUD і notification-повідомлення.
- `src/auth/` веде покрокову авторизацію Telegram account через bot.
- `src/configs/` працює з per-user scraper config і due-selection для scheduler.
- `src/crypto/` шифрує чутливі дані через AES-256-GCM.
- `src/db/` містить PostgreSQL pool і migration runner.
- `src/scraper/` читає джерела, фільтрує повідомлення і ставить delivery у чергу.
- `src/delivery/` відповідає за outbox, delivered-post history і захист від дублікатів.
- `src/telegram/` містить adapter для Telegram account client.
- `migrations/001_init.sql` створює таблиці й ключові constraints.
- `test/` містить unit/regression тести для фільтрації, auth flow, SQL invariants, encryption і scheduler-adjacent логіки.

## Технології

- Node.js CommonJS.
- PostgreSQL через `pg`.
- Telegram Bot API через lightweight polling client у `src/bot/botApi.js`.
- GramJS (`telegram`) як default runtime adapter для реального `StringSession` flow.
- `tdl` і `prebuilt-tdlib` підключені як TDLib adapter checkpoint; operational TDLib path потребує окремого wiring.
- Docker Compose для локального запуску app + PostgreSQL.
- `node --test` для тестів.
- Prettier для форматування.

## Конфігурація середовища

Приклад значень лежить у `.env.example`.

| Змінна                              | Призначення                                                       |
| ----------------------------------- | ----------------------------------------------------------------- |
| `NODE_ENV`                          | Режим запуску, наприклад `development` або `test`.                |
| `DATABASE_URL`                      | PostgreSQL connection string.                                     |
| `BOT_TOKEN`                         | Token Telegram bot з BotFather.                                   |
| `ENCRYPTION_KEY`                    | 32-byte key або base64-encoded 32 bytes для AES-256-GCM.          |
| `GLOBAL_SCHEDULER_INTERVAL_MINUTES` | Global scheduler tick. За ТЗ використовується `20`.               |
| `TELEGRAM_ADAPTER`                  | `gramjs`, `tdlib` або `fake`. Default: `gramjs`, у тестах `fake`. |
| `TDLIB_DATABASE_DIRECTORY`          | TDLib database directory, якщо використовується `tdlib`.          |
| `TDLIB_FILES_DIRECTORY`             | TDLib files directory, якщо використовується `tdlib`.             |

Чутливі поля користувача (`apiId`, `apiHash`, `stringSessionSTR`) не мають зберігатися в plaintext. Вони шифруються перед записом у PostgreSQL.

## Запуск локально

1. Встановити залежності:

```bash
npm install
```

2. Підготувати `.env` на основі `.env.example`.

3. Запустити PostgreSQL і застосунок через Docker Compose:

```bash
docker compose up --build
```

4. Або запускати Node.js процес локально, якщо PostgreSQL уже доступний:

```bash
npm run migrate
npm start
```

## Команди розробки

```bash
npm run migrate
```

Застосовує SQL migrations із `migrations/`.

```bash
npm test
```

Запускає тестовий набір через `node --test`.

```bash
npm run format:check
npm run format
```

Перевіряє або застосовує Prettier. Якщо локальні OMX/state файли заважають повній перевірці, використовуйте scoped check для project files.

## Telegram bot flow

Користувач працює із застосунком через bot:

- `/start` створює або оновлює профіль користувача і створює default config.
- ` ` показує доступні команди.
- `/get_config` показує поточний конфіг.
- `/delete_config` видаляє конфіг поточного користувача.
- `/set key value` змінює дозволене поле конфігу або секрет.
- `/auth` запускає authorization flow у приватному чаті.

Авторизація дозволена тільки в private chat. Bot послідовно збирає `apiId`, `apiHash`, phone number, verification code і 2FA password, якщо він потрібен. Verification code і 2FA password не зберігаються. Після успішної авторизації `stringSessionSTR` записується в БД у зашифрованому вигляді.

## Дозволені поля конфігу

Config CRUD обмежений такими полями:

- `isEnable: boolean`
- `days: number`
- `limit: number`
- `intervalMinutes: number`, мінімум `20`
- `channelToSend: string`, наприклад `me`, chat id або bot chat
- `channels: string[]`
- `keywords: string[]`
- `keywords2: string[]`
- `banWords: string[]`

`apiId` і `apiHash` приймаються через `/set`, але зберігаються в `telegram_secrets`, а не в `scraper_configs`.

Приклади:

```text
/set isEnable true
/set intervalMinutes 60
/set channelToSend me
/set channels channel1,-1001234567890
/set keywords робота,фриланс,сайт
/set keywords2 дизайн,лендінг
/set banWords вакансія,офіс
```

## Scheduler

Є один global scheduler. Він стартує одразу після запуску app і далі повторюється кожні `GLOBAL_SCHEDULER_INTERVAL_MINUTES`.

На кожному tick scheduler:

1. Вибирає enabled configs, які due за `last_scraped_at` і `interval_minutes`.
2. Лочить config через `locked_at`, щоб уникнути паралельного запуску.
3. Виконує scraping для конкретного користувача.
4. Записує `scrape_runs`.
5. Оновлює `last_scraped_at` і знімає lock.
6. Відправляє pending delivery outbox.

Якщо global tick дорівнює 20 хв, а в користувача `intervalMinutes = 60`, його config буде пропущено на перших двох ticks і виконано на третьому.

## Scraper і фільтрація

Scraper запускається тільки якщо є encrypted `apiId`, `apiHash`, `stringSessionSTR` і `session_status = active`.

Для кожного джерела з `channels` він читає останні `limit` повідомлень, застосовує фільтр і ставить релевантні повідомлення в `delivery_outbox`.

Повідомлення проходить фільтр, якщо:

1. Воно не старіше за `days`.
2. Містить хоча б одне слово з `keywords`.
3. Не містить слів із `banWords`.
4. Якщо `keywords2` не порожній, містить хоча б одне слово з `keywords2`.

Пошук виконується як case-insensitive substring match.

## Доставка і дублікати

Доставка побудована через outbox:

- `delivery_outbox` отримує pending повідомлення.
- Unique constraint на `(user_id, config_id, source_id, message_id)` не дає поставити той самий пост повторно.
- Після успішної відправки `markDeliverySent()` в одній PostgreSQL transaction створює запис у `delivered_posts` і позначає outbox row як `sent`.
- Якщо Telegram send впав, `attempts` збільшується, а помилка зберігається в `last_error`.

Система має at-least-once residual risk між зовнішнім Telegram send і PostgreSQL commit, бо ці операції не можуть бути атомарними між різними системами.

## Missing або expired session

Якщо session відсутня або неактивна:

1. Scraper не запускає читання джерел.
2. `session_status` оновлюється на `reauthorization_required`.
3. Bot надсилає користувачу notification з проханням виконати `/auth`.

Якщо Telegram account client повертає session/auth помилку під час scraping, застосунок обробляє це як expired session і запускає той самий reauthorization path.

## База даних

Основні таблиці:

- `bot_users` - Telegram bot users.
- `scraper_configs` - один config на користувача.
- `telegram_secrets` - encrypted `apiId`, `apiHash`, `stringSessionSTR`, session status.
- `auth_flows` - активний authorization state.
- `delivery_outbox` - черга повідомлень на доставку.
- `delivered_posts` - історія доставлених постів.
- `scrape_runs` - журнал запусків scraper.
- `schema_migrations` - застосовані migrations.

Критичні invariants задаються в SQL: one config per user, one secrets row per user, one active auth flow per user, outbox/delivered uniqueness.

## Відомі обмеження

- Default реальний adapter - GramJS, бо ТЗ вимагає `stringSessionSTR`. TDLib dependency підключена й імпорт перевірений, але TDLib operational methods залишені як явний adapter checkpoint.
- Bot API polling простий і process-local; для production scaling потрібен webhook або distributed polling lock.
- Outbox дає захист від повторної постановки в чергу, але не може зробити Telegram send і DB commit повністю атомарними.
- Повноцінний SaaS admin, billing і джерела поза Telegram не входять у v1.

## Перевірений стан

Остання локальна перевірка після rewrite:

- `npm test` - 21/21 passing.
- Scoped `prettier --check` для project files - passing.
- `node --check` для `app.js`, `src/**`, `test/**` - passing.
- `docker compose config` - valid.
- Smoke import для `tdl`, `prebuilt-tdlib` і `telegram` - passing.

`docker compose up -d postgres` не був підтверджений у поточному середовищі, бо Docker daemon недоступний на машині.
