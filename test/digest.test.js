const test = require('node:test');
const assert = require('node:assert/strict');
const { createGas } = require('./gas');
const { weatherAt14, weatherAt08, MORNING, demoOptions, EXPECTED_MORNING_DIGEST } = require('./demo-data');

const overloaded = { error: true, reason: 'The service is overloaded' };

test('даты: сдвиги, разница дней и полночь с учётом перевода часов', () => {
  const { run } = createGas();
  assert.equal(run("addDays_('2026-12-31', 1)"), '2027-01-01');
  assert.equal(run("addDays_('2026-03-01', -1)"), '2026-02-28');
  assert.equal(run("daysBetween_('2026-10-09', '2026-10-13')"), 4);
  assert.equal(run("startOfDayIso_('2026-10-09')"), '2026-10-09T00:00:00+02:00');
  assert.equal(run("startOfDayIso_('2026-12-01')"), '2026-12-01T00:00:00+01:00');
  // 25 октября 2026 переводят часы: в полночь смещение ещё летнее.
  assert.equal(run("startOfDayIso_('2026-10-25')"), '2026-10-25T00:00:00+02:00');
  assert.equal(run("startOfDayIso_('2026-03-29')"), '2026-03-29T00:00:00+01:00');
  assert.equal(run("formatLongDate_('2026-10-09')"), 'Пятница, 9 октября');
  assert.equal(run("relativeDayLabel_('2026-10-09', '2026-10-12')"), 'Пн, 12 окт');
  assert.deepEqual(
    run("[1, 2, 5, 11, 12, 21, 22, 25].map(n => plural_(n, ['день', 'дня', 'дней']))"),
    ['день', 'дня', 'дней', 'дней', 'дней', 'день', 'дня', 'дней'],
  );
});

test('погода: реальный прогноз берётся с текущего часа до конца дня', () => {
  const gas = createGas();
  gas.context.data = weatherAt14;
  const w = gas.run('summarizeWeather_(data, CONFIG.weather)');
  assert.deepEqual(w, { nowTemp: 12.7, feelsLike: 8.4, minTemp: 11.3, maxTemp: 13.7, code: 3, rain: null, gust: 51 });
  assert.equal(
    gas.run('formatWeather_(summarizeWeather_(data, CONFIG.weather), "Варшава")'),
    '☁️ <b>Варшава</b>: сейчас +13° (ощущается +8°), днём +11…+14°\nПасмурно\n💨 Порывы ветра до 51 км/ч',
  );
});

test('погода: ночной дождь, который уже закончился, не превращает день в дождливый', () => {
  // Ночью (0–6 ч) в фикстуре был дождь с высокой вероятностью.
  const night = weatherAt08.hourly.precipitation_probability.slice(0, 7);
  assert.ok(night.some((p) => p >= 50));
  assert.ok(weatherAt08.hourly.weather_code.slice(0, 7).some((c) => c >= 51));
  const gas = createGas();
  gas.context.data = weatherAt08;
  const w = gas.run('summarizeWeather_(data, CONFIG.weather)');
  assert.equal(w.rain, null);
  assert.equal(w.code, 3);
});

function syntheticWeather({ nowHour, rain = {}, codes = {}, temp = 10 }) {
  const hours = Array.from({ length: 24 }, (_, h) => h);
  return {
    current: { time: `2026-10-09T${String(nowHour).padStart(2, '0')}:00`, temperature_2m: temp, apparent_temperature: temp, weather_code: 3 },
    hourly: {
      time: hours.map((h) => `2026-10-09T${String(h).padStart(2, '0')}:00`),
      temperature_2m: hours.map(() => temp),
      precipitation_probability: hours.map((h) => rain[h] || 0),
      weather_code: hours.map((h) => codes[h] || 2),
      wind_gusts_10m: hours.map(() => 10),
    },
  };
}

test('погода: окно дождя, зонт и снег', () => {
  const gas = createGas();
  const summarize = (data) => {
    gas.context.data = data;
    return gas.run('summarizeWeather_(data, CONFIG.weather)');
  };

  const afternoon = summarize(syntheticWeather({ nowHour: 8, rain: { 15: 60, 16: 90, 17: 70 }, codes: { 15: 61, 16: 63, 17: 61 } }));
  assert.equal(afternoon.rain, 'с 15:00 до 18:00');
  assert.equal(afternoon.code, 63);

  assert.equal(summarize(syntheticWeather({ nowHour: 8, rain: { 8: 80, 9: 80, 10: 55 } })).rain, 'до 11:00');
  assert.equal(summarize(syntheticWeather({ nowHour: 8, rain: { 19: 60, 20: 60, 21: 60, 22: 60 } })).rain, 'с 19:00 и до ночи');

  const allDay = {};
  for (let h = 8; h <= 22; h++) allDay[h] = 75;
  assert.equal(summarize(syntheticWeather({ nowHour: 8, rain: allDay })).rain, 'весь день');

  gas.context.data = syntheticWeather({ nowHour: 8, rain: { 12: 70 }, codes: { 12: 73 }, temp: -2.4 });
  assert.equal(
    gas.run('formatWeather_(summarizeWeather_(data, CONFIG.weather), "Варшава")'),
    '🌨 <b>Варшава</b>: сейчас −2°, днём −2°\nСнег\n❄️ Снег вероятен с 12:00 до 13:00',
  );
});

test('погода: повторяет запрос, если Open-Meteo перегружен', () => {
  const gas = createGas({ weather: [overloaded, weatherAt14] });
  assert.equal(gas.run('fetchWeather_().current.time'), '2026-10-09T14:00');
  assert.equal(gas.calls.weather, 2);
});

test('календарь: только отмеченные календари, без отклонённых, прошедших и дублей', () => {
  const gas = createGas(demoOptions);
  gas.context.now = MORNING;
  const events = gas.run("fetchTodayEvents_('2026-10-09', now)");
  assert.deepEqual(events.map((e) => e.title), ['Праздник', 'Командировка', 'Созвон с <клиентом> & co', 'Стоматолог']);

  const asked = gas.calls.events.map((c) => c.calendarId);
  assert.ok(!asked.includes('hidden@group.calendar.google.com'), 'скрытый календарь не запрашиваем');
  assert.ok(!asked.includes('addressbook#contacts@group.v.calendar.google.com'), 'календарь контактов — не события');
  assert.equal(gas.calls.events[0].params.timeMin, '2026-10-09T00:00:00+02:00');
  assert.equal(gas.calls.events[0].params.timeMax, '2026-10-10T00:00:00+02:00');
  assert.equal(gas.calls.events[0].params.singleEvents, true);
});

test('календарь: основной берётся, даже если галочка в веб-версии не стоит', () => {
  const gas = createGas({
    calendars: [{ id: 'me@gmail.com', primary: true }, { id: 'other@group.calendar.google.com', selected: false }],
    events: { 'me@gmail.com': [{ summary: 'Встреча', start: { dateTime: '2026-10-09T12:00:00+02:00' }, end: { dateTime: '2026-10-09T13:00:00+02:00' } }] },
  });
  gas.context.now = MORNING;
  assert.deepEqual(gas.run("fetchTodayEvents_('2026-10-09', now)").map((e) => e.title), ['Встреча']);
  assert.deepEqual(gas.calls.events.map((c) => c.calendarId), ['me@gmail.com']);
});

test('дни рождения: основной календарь, а если пусто — старый календарь контактов', () => {
  const fresh = createGas(demoOptions);
  assert.deepEqual(fresh.run("fetchBirthdays_('2026-10-09')"), [
    { date: '2026-10-09', name: 'Андрей', self: false },
    { date: '2026-10-10', name: 'Я', self: true },
    { date: '2026-10-13', name: 'Мама', self: false },
  ]);
  assert.equal(fresh.calls.events[0].params.timeMax, '2026-10-17T00:00:00+02:00');

  const legacy = createGas({
    birthdays: [],
    events: { 'addressbook#contacts@group.v.calendar.google.com': [{ summary: 'Олег', start: { date: '2026-10-11' } }] },
  });
  assert.deepEqual(legacy.run("fetchBirthdays_('2026-10-09')"), [{ date: '2026-10-11', name: 'Олег', self: false }]);
});

test('дедлайны: просроченные и ближайшие, без задач без даты и далёких', () => {
  const gas = createGas(demoOptions);
  assert.deepEqual(gas.run("fetchDeadlines_('2026-10-09')"), [
    { date: '2026-10-07', title: 'Оплатить интернет' },
    { date: '2026-10-09', title: 'Сдать проект' },
    { date: '2026-10-10', title: 'Завтрашнее' },
    { date: '2026-10-11', title: 'Купить подарок' },
  ]);
});

test('сводка целиком: утро пятницы', () => {
  const gas = createGas(demoOptions);
  gas.context.now = MORNING;
  assert.equal(gas.run('buildDigest_(now)'), EXPECTED_MORNING_DIGEST);
});

test('сводка: упавший блок не ломает остальные, пустые разделы скрываются', () => {
  const gas = createGas({ ...demoOptions, birthdays: [], taskLists: {}, events: {}, weather: [overloaded] });
  gas.context.now = MORNING;
  const text = gas.run('buildDigest_(now)');
  assert.match(text, /🌡 Погоду получить не удалось: The service is overloaded/);
  assert.match(text, /📅 <b>Сегодня<\/b>\nСобытий нет, день свободен/);
  assert.doesNotMatch(text, /Дни рождения|Дедлайны/);
  assert.equal(gas.calls.weather, 3);
});

test('setup: находит чат, ставит один триггер и шлёт пробную сводку', () => {
  const gas = createGas({
    ...demoOptions,
    properties: { TELEGRAM_TOKEN: 'test-token' },
    updates: [{ message: { chat: { id: 42, first_name: 'Тест', username: 'test_user' } } }],
    existingTriggers: ['sendDigest', 'somethingElse'],
  });
  gas.run('setup()');

  assert.equal(gas.props.TELEGRAM_CHAT_ID, '42');
  assert.equal(gas.calls.deletedTriggers, 1, 'старый триггер сводки удалён, чужие не трогаем');
  assert.deepEqual(gas.calls.triggers, [{ handler: 'sendDigest', everyDays: 1, atHour: 8, nearMinute: 0, timeZone: 'Europe/Warsaw' }]);

  const sent = gas.calls.telegram.find((c) => c.method === 'sendMessage');
  assert.equal(sent.url, 'https://api.telegram.org/bottest-token/sendMessage');
  assert.equal(sent.payload.chat_id, '42');
  assert.equal(sent.payload.parse_mode, 'HTML');
  assert.match(sent.payload.text, /^<b>Доброе утро!<\/b>/);
});

test('setup: понятная ошибка, если боту ещё не писали', () => {
  const gas = createGas({ properties: { TELEGRAM_TOKEN: 'test-token' }, updates: [] });
  assert.throws(() => gas.run('setup()'), /Напиши ему что-нибудь/);
});

test('telegram: длинное сообщение режется по строкам, теги не рвутся', () => {
  const gas = createGas();
  gas.context.long = Array.from({ length: 400 }, (_, i) => `• <b>${i}</b> строка`).join('\n');
  const text = gas.run('fitTelegramLimit_(long)');
  assert.ok(text.length <= 4096);
  assert.ok(text.endsWith('\n…'));
  assert.equal(text.split('<b>').length, text.split('</b>').length);
});
