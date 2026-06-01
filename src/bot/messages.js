function statusMessage(config) {
  if (!config) return 'Конфіг ще не створено. Використайте /config_help.'

  return [
    `Статус: ${config.isEnable ? 'увімкнено' : 'вимкнено'}`,
    `Період: ${config.intervalMinutes} хв`,
    `Днів: ${config.days}`,
    `Ліміт: ${config.limit}`,
    `Куди надсилати: ${config.channelToSend}`,
    `Джерел: ${config.channels.length}`,
    `Ключових слів: ${config.keywords.length}`
  ].join('\n')
}

const MESSAGES = {
  start:
    'Готово. Я створив ваш профіль. Використайте /config_help для налаштувань або /auth для авторизації Telegram акаунта.',
  configHelp:
    'Команди: /set key value, /get_config, /delete_config. Масиви вводьте через кому: /set keywords робота,фриланс.',
  authStart: 'Починаємо авторизацію Telegram акаунта. Надішліть apiId числом.',
  privateAuthOnly:
    'Авторизацію можна проходити тільки в приватному чаті з ботом.',
  authRequired:
    'Потрібна повторна авторизація Telegram акаунта. Відкрийте приватний чат з ботом і виконайте /auth.',
  authComplete:
    'Авторизацію завершено. Сесію збережено у зашифрованому вигляді.',
  unknown: 'Команду не розпізнано. Використайте /config_help.'
}

module.exports = {
  MESSAGES,
  statusMessage
}
