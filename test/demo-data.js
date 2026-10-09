// Демо-данные на пятницу, 9 октября 2026: используются в тестах и в npm run preview.
const fs = require('node:fs');
const path = require('node:path');

// Настоящий ответ Open-Meteo по Варшаве, снятый в 14:00 того дня.
const weatherAt14 = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'open-meteo-warsaw.json'), 'utf8'));

// Тот же прогноз, но как будто запрос сделан в 8 утра.
const weatherAt08 = {
  ...weatherAt14,
  current: { ...weatherAt14.current, time: '2026-10-09T08:00', temperature_2m: 9.9, apparent_temperature: 5.7, weather_code: 3 },
};

const MORNING = new Date('2026-10-09T06:00:00Z'); // 8:00 по Варшаве

const calendars = [
  { id: 'primary', selected: true },
  { id: 'holidays@group.v.calendar.google.com', selected: true },
  { id: 'hidden@group.calendar.google.com', selected: false },
  { id: 'addressbook#contacts@group.v.calendar.google.com', selected: true },
];

const at = (time) => ({ dateTime: `2026-10-09T${time}:00+02:00` });
const day = (date) => ({ date });

const events = {
  primary: [
    { summary: 'Стоматолог', start: at('15:30'), end: at('16:30') },
    { summary: 'Созвон с <клиентом> & co', start: at('10:00'), end: at('11:00') },
    { summary: 'Командировка', start: { dateTime: '2026-10-08T09:00:00+02:00' }, end: at('12:00') },
    { summary: 'Ранняя пробежка', start: at('06:30'), end: at('07:15') },
    { summary: 'Отклонённая встреча', start: at('13:00'), end: at('14:00'), attendees: [{ self: true, responseStatus: 'declined' }] },
    { summary: 'Офис', eventType: 'workingLocation', start: day('2026-10-09'), end: day('2026-10-10') },
    { summary: 'Андрей', eventType: 'birthday', start: day('2026-10-09'), end: day('2026-10-10') },
  ],
  'holidays@group.v.calendar.google.com': [
    { summary: 'Праздник', start: day('2026-10-09'), end: day('2026-10-10') },
    { summary: 'Стоматолог', start: at('15:30'), end: at('16:30') }, // дубль из общего календаря
  ],
  'hidden@group.calendar.google.com': [
    { summary: 'Не должно попасть', start: at('12:00'), end: at('13:00') },
  ],
};

const birthdays = [
  { summary: 'Мама', eventType: 'birthday', start: day('2026-10-13') },
  { summary: 'Андрей', eventType: 'birthday', start: day('2026-10-09') },
  { summary: 'Я', eventType: 'birthday', start: day('2026-10-10'), birthdayProperties: { type: 'self' } },
];

const due = (date) => `${date}T00:00:00.000Z`;

const taskLists = {
  personal: [
    { title: 'Купить подарок', due: due('2026-10-11'), status: 'needsAction' },
    { title: 'Оплатить интернет', due: due('2026-10-07'), status: 'needsAction' },
    { title: 'Сдать проект', due: due('2026-10-09'), status: 'needsAction' },
    { title: 'Через три недели', due: due('2026-10-30'), status: 'needsAction' },
    { title: 'Без даты', status: 'needsAction' },
    { title: '', due: due('2026-10-09'), status: 'needsAction' },
  ],
  work: [
    { title: 'Завтрашнее', due: due('2026-10-10'), status: 'needsAction' },
  ],
};

const EXPECTED_MORNING_DIGEST = [
  '<b>Доброе утро!</b> Пятница, 9 октября',
  '',
  '☁️ <b>Варшава</b>: сейчас +10° (ощущается +6°), днём +10…+14°',
  'Пасмурно',
  '💨 Порывы ветра до 53 км/ч',
  '',
  '📅 <b>Сегодня</b>',
  '• Весь день: Праздник',
  '• <b>до 12:00</b> Командировка',
  '• <b>10:00–11:00</b> Созвон с &lt;клиентом&gt; &amp; co',
  '• <b>15:30–16:30</b> Стоматолог',
  '',
  '🎂 <b>Дни рождения</b>',
  '• Сегодня: Андрей',
  '• Завтра: твой день рождения 🎉',
  '• Вт, 13 окт (через 4 дня): Мама',
  '',
  '⏰ <b>Дедлайны</b>',
  '• ❗ Просрочено с 7 окт: Оплатить интернет',
  '• Сегодня: Сдать проект',
  '• Завтра: Завтрашнее',
  '• Вс, 11 окт: Купить подарок',
].join('\n');

module.exports = {
  weatherAt14,
  weatherAt08,
  MORNING,
  demoOptions: { calendars, events, birthdays, taskLists, weather: [weatherAt08] },
  EXPECTED_MORNING_DIGEST,
};
