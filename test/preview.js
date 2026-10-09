// Показывает, как выглядит сводка, на демо-данных: npm run preview
const { createGas } = require('./gas');
const { MORNING, demoOptions } = require('./demo-data');

const gas = createGas(demoOptions);
gas.context.now = MORNING;
const text = gas.run('buildDigest_(now)');

// В терминале убираем HTML-разметку Telegram, чтобы читалось как в чате.
console.log(text.replace(/<\/?b>/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
