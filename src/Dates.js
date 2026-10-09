// Даты храним ключами 'yyyy-MM-dd' в часовом поясе сводки: так проще
// сравнивать дни и не ловить сдвиги из-за перевода часов.

const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Ключ дня для момента времени в часовом поясе сводки. */
function dayKey_(date) {
  return Utilities.formatDate(date, CONFIG.timeZone, 'yyyy-MM-dd');
}

/** Сдвигает ключ дня на n дней — чистая календарная арифметика. */
function addDays_(key, n) {
  const d = new Date(key + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Сколько дней от fromKey до toKey (может быть отрицательным). */
function daysBetween_(fromKey, toKey) {
  return Math.round((Date.parse(toKey + 'T12:00:00Z') - Date.parse(fromKey + 'T12:00:00Z')) / 86400000);
}

/**
 * Полночь дня в часовом поясе сводки в формате RFC 3339 — для Calendar API.
 * Смещение берём на 00:00 UTC: для Европы это ещё до перевода часов, то есть
 * то же смещение, что и в местную полночь.
 */
function startOfDayIso_(key) {
  const offset = Utilities.formatDate(new Date(key + 'T00:00:00Z'), CONFIG.timeZone, 'XXX');
  return key + 'T00:00:00' + offset;
}

/** Время 'HH:mm' в часовом поясе сводки для RFC 3339 строки. */
function formatTime_(isoDateTime) {
  return Utilities.formatDate(new Date(isoDateTime), CONFIG.timeZone, 'HH:mm');
}

function parseKey_(key) {
  const d = new Date(key + 'T12:00:00Z');
  return { weekday: d.getUTCDay(), day: d.getUTCDate(), month: d.getUTCMonth() };
}

/** 'Пятница, 9 октября' */
function formatLongDate_(key) {
  const p = parseKey_(key);
  return capitalize_(WEEKDAYS[p.weekday]) + ', ' + p.day + ' ' + MONTHS_GENITIVE[p.month];
}

/** 'пн, 13 окт' */
function formatShortDate_(key) {
  const p = parseKey_(key);
  return WEEKDAYS_SHORT[p.weekday] + ', ' + p.day + ' ' + MONTHS_SHORT[p.month];
}

/** '7 окт' */
function formatDayMonth_(key) {
  const p = parseKey_(key);
  return p.day + ' ' + MONTHS_SHORT[p.month];
}

/** 'Сегодня', 'Завтра' или 'Пн, 13 окт'. */
function relativeDayLabel_(todayKey, key) {
  const diff = daysBetween_(todayKey, key);
  if (diff === 0) return 'Сегодня';
  if (diff === 1) return 'Завтра';
  return capitalize_(formatShortDate_(key));
}

/** plural_(3, ['день', 'дня', 'дней']) === 'дня' */
function plural_(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}

function capitalize_(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
