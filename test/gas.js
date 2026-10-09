// Запускает файлы из src/ в отдельном контексте с заглушками сервисов
// Apps Script, чтобы проверять логику локально, без Google и Telegram.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC = path.join(__dirname, '..', 'src');

/** Utilities.formatDate только для шаблонов, которые использует код. */
function formatDate(date, timeZone, pattern) {
  const parts = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(date).forEach((p) => { parts[p.type] = p.value; });

  if (pattern === 'yyyy-MM-dd') return `${parts.year}-${parts.month}-${parts.day}`;
  if (pattern === 'HH:mm') return `${parts.hour}:${parts.minute}`;
  if (pattern === 'XXX') return parts.timeZoneName === 'GMT' ? 'Z' : parts.timeZoneName.slice(3);
  throw new Error('Шаблон не поддержан заглушкой: ' + pattern);
}

function jsonResponse(body, code = 200) {
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  return { getResponseCode: () => code, getContentText: () => text };
}

/**
 * opts.calendars       — [{ id, selected }] для CalendarList
 * opts.events          — { calendarId: [event] }; календаря нет в списке → 404
 * opts.birthdays       — события типа birthday в основном календаре
 * opts.taskLists       — { listId: [task] }
 * opts.weather         — массив ответов Open-Meteo по очереди (последний повторяется)
 * opts.updates         — ответ Telegram getUpdates
 * opts.properties      — Script Properties
 */
function createGas(opts = {}) {
  const calls = { events: [], weather: 0, telegram: [], triggers: [], deletedTriggers: 0 };
  const props = { ...opts.properties };
  const weather = opts.weather || [];

  const context = {
    console: opts.verbose ? console : { log() {}, warn() {}, error() {} },
    Utilities: { formatDate, sleep() {} },
    UrlFetchApp: {
      fetch(url, params) {
        if (url.startsWith('https://api.telegram.org/')) {
          const method = url.split('/').pop();
          const payload = JSON.parse(params.payload);
          calls.telegram.push({ url, method, payload });
          if (method === 'getUpdates') return jsonResponse({ ok: true, result: opts.updates || [] });
          return jsonResponse({ ok: true, result: { message_id: calls.telegram.length } });
        }
        const body = weather[Math.min(calls.weather, weather.length - 1)];
        calls.weather++;
        return jsonResponse(body);
      },
    },
    Calendar: {
      CalendarList: { list: () => ({ items: opts.calendars || [] }) },
      Events: {
        list(calendarId, params) {
          calls.events.push({ calendarId, params });
          if (params.eventTypes) return { items: calendarId === 'primary' ? opts.birthdays || [] : [] };
          const events = (opts.events || {})[calendarId];
          if (!events) throw new Error('Not Found');
          return { items: events };
        },
      },
    },
    Tasks: {
      Tasklists: { list: () => ({ items: Object.keys(opts.taskLists || {}).map((id) => ({ id })) }) },
      Tasks: { list: (listId) => ({ items: opts.taskLists[listId] }) },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => (key in props ? props[key] : null),
        setProperty: (key, value) => { props[key] = value; },
        deleteProperty: (key) => { delete props[key]; },
      }),
    },
    ScriptApp: {
      getProjectTriggers: () => (opts.existingTriggers || []).map((handler) => ({ getHandlerFunction: () => handler })),
      deleteTrigger: () => { calls.deletedTriggers++; },
      newTrigger(handler) {
        const trigger = { handler };
        calls.triggers.push(trigger);
        const builder = {
          timeBased: () => builder,
          everyDays: (n) => { trigger.everyDays = n; return builder; },
          atHour: (h) => { trigger.atHour = h; return builder; },
          nearMinute: (m) => { trigger.nearMinute = m; return builder; },
          inTimezone: (tz) => { trigger.timeZone = tz; return builder; },
          create: () => trigger,
        };
        return builder;
      },
    },
  };

  vm.createContext(context);
  for (const file of fs.readdirSync(SRC).filter((f) => f.endsWith('.js')).sort()) {
    vm.runInContext(fs.readFileSync(path.join(SRC, file), 'utf8'), context, { filename: file });
  }

  return {
    calls,
    props,
    /** Выполняет выражение внутри контекста и возвращает результат обычным объектом. */
    run: (code) => {
      const result = vm.runInContext(code, context);
      return result !== null && typeof result === 'object' ? JSON.parse(JSON.stringify(result)) : result;
    },
    context,
  };
}

module.exports = { createGas };
