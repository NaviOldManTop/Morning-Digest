// Функции, которые можно запускать из редактора Apps Script.
// Всё с подчёркиванием в конце имени — внутреннее и в меню запуска не видно.

/** Ежедневный запуск по триггеру: собирает сводку и отправляет в Telegram. */
function sendDigest() {
  let text;
  try {
    text = buildDigest_(new Date());
  } catch (e) {
    console.error(e.stack || e);
    text = '⚠️ Утренняя сводка не собралась: ' + escapeHtml_(e.message || e);
  }
  sendTelegramMessage_(text);
}

/** Собирает сводку и печатает её в журнал выполнения, ничего не отправляя. */
function previewDigest() {
  console.log(buildDigest_(new Date()));
}

/**
 * Первый запуск. Перед ним: добавить TELEGRAM_TOKEN в свойства скрипта и
 * написать боту любое сообщение. Запоминает чат, ставит ежедневный триггер
 * и сразу присылает пробную сводку. Повторный запуск безопасен.
 */
function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('TELEGRAM_CHAT_ID')) {
    const chat = findChat_();
    props.setProperty('TELEGRAM_CHAT_ID', String(chat.id));
    console.log('Сводка будет приходить в чат: ' + describeChat_(chat));
  }

  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'sendDigest') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('sendDigest')
    .timeBased()
    .everyDays(1)
    .atHour(CONFIG.sendHour)
    .nearMinute(0)
    .inTimezone(CONFIG.timeZone)
    .create();
  console.log('Триггер поставлен: каждый день около ' + CONFIG.sendHour + ':00 (' + CONFIG.timeZone + ').');

  sendDigest();
  console.log('Пробная сводка отправлена.');
}

/** Забыть сохранённый чат — например, чтобы получать сводку в другой. */
function resetChat() {
  PropertiesService.getScriptProperties().deleteProperty('TELEGRAM_CHAT_ID');
  console.log('Чат забыт. Напиши боту из нужного чата и запусти setup().');
}
