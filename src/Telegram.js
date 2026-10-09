const TELEGRAM_LIMIT = 4096;

function telegramApi_(method, payload) {
  const token = PropertiesService.getScriptProperties().getProperty('TELEGRAM_TOKEN');
  if (!token) {
    throw new Error('Не задан TELEGRAM_TOKEN: добавь его в «Настройки проекта → Свойства скрипта».');
  }
  const res = UrlFetchApp.fetch('https://api.telegram.org/bot' + token + '/' + method, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload || {}),
    muteHttpExceptions: true,
  });
  const data = JSON.parse(res.getContentText());
  if (!data.ok) throw new Error('Telegram ' + method + ': ' + data.description);
  return data.result;
}

function sendTelegramMessage_(text) {
  const chatId = PropertiesService.getScriptProperties().getProperty('TELEGRAM_CHAT_ID');
  if (!chatId) throw new Error('Не задан TELEGRAM_CHAT_ID: сначала запусти setup().');
  return telegramApi_('sendMessage', {
    chat_id: chatId,
    text: fitTelegramLimit_(text),
    parse_mode: 'HTML',
    link_preview_options: { is_disabled: true },
  });
}

/** Чат, из которого боту написали последним. */
function findChat_() {
  const updates = telegramApi_('getUpdates', {});
  for (let i = updates.length - 1; i >= 0; i--) {
    const msg = updates[i].message || updates[i].edited_message;
    if (msg && msg.chat) return msg.chat;
  }
  throw new Error('Бот пока не получал сообщений. Напиши ему что-нибудь в Telegram и запусти setup() ещё раз.');
}

function describeChat_(chat) {
  const name = [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.title || String(chat.id);
  return chat.username ? name + ' (@' + chat.username + ')' : name;
}

/** Обрезает по целым строкам, чтобы не разорвать HTML-теги. */
function fitTelegramLimit_(text) {
  if (text.length <= TELEGRAM_LIMIT) return text;
  const lines = text.split('\n');
  let out = '';
  for (let i = 0; i < lines.length; i++) {
    const next = out ? out + '\n' + lines[i] : lines[i];
    if (next.length > TELEGRAM_LIMIT - 2) break;
    out = next;
  }
  return out + '\n…';
}
