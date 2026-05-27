const { TelegramClient } = require('@mtcute/node');

// Підстав сюди свої дані
const apiId = 20146765; 
const apiHash = '95c08c9eaeaa5f5a9c0dcc5ee5eccf41';

const tg = new TelegramClient({
    apiId,
    apiHash,
    storage: 'my-temp-session'
});

async function main() {
    console.log('Підключення до Telegram...');
    
    await tg.start({
        // mtcute сам виведе промпти в консоль для вводу номера, коду та пароля
    });

    console.log('\n✅ Успішна авторизація!');
    
    const sessionString = await tg.exportSession();
    console.log('\nТвоя StringSession (скопіюй її у свій const.js або .env):');
    console.log('====================================');
    console.log(sessionString);
    console.log('====================================');
    
    process.exit(0);
}

main().catch(console.error);