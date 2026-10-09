// В старых аккаунтах Google дни рождения контактов лежат в отдельном
// календаре, в новых — это события типа birthday в основном календаре.
const CONTACTS_BIRTHDAY_CALENDARS = [
  'addressbook#contacts@group.v.calendar.google.com',
  '#contacts@group.v.calendar.google.com',
];

/** Оставшиеся на сегодня события из всех нужных календарей, без дней рождения. */
function fetchTodayEvents_(todayKey, now) {
  const range = { timeMin: startOfDayIso_(todayKey), timeMax: startOfDayIso_(addDays_(todayKey, 1)) };
  const seen = {};
  const events = [];

  listCalendarIds_().forEach(function (calendarId) {
    if (calendarId.indexOf('#contacts@') !== -1) return;
    let items;
    try {
      items = listEvents_(calendarId, range);
    } catch (e) {
      console.warn('Календарь ' + calendarId + ' пропущен: ' + e.message);
      return;
    }
    items.forEach(function (ev) {
      if (ev.eventType === 'birthday' || ev.eventType === 'workingLocation') return;
      if (ev.status === 'cancelled' || isDeclined_(ev)) return;
      const item = {
        allDay: Boolean(ev.start.date),
        start: ev.start.dateTime || ev.start.date,
        end: ev.end ? ev.end.dateTime || ev.end.date : null,
        title: ev.summary || '(без названия)',
      };
      if (!item.allDay && item.end && Date.parse(item.end) <= now.getTime()) return;
      // Одна и та же встреча может прийти из нескольких календарей.
      const key = item.title + '|' + item.start;
      if (seen[key]) return;
      seen[key] = true;
      events.push(item);
    });
  });

  return events.sort(function (a, b) {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return Date.parse(a.start) - Date.parse(b.start);
  });
}

/** Дни рождения на сегодня и ближайшие birthdaysAheadDays дней. */
function fetchBirthdays_(todayKey) {
  const range = {
    timeMin: startOfDayIso_(todayKey),
    timeMax: startOfDayIso_(addDays_(todayKey, CONFIG.calendar.birthdaysAheadDays + 1)),
  };

  let items = [];
  try {
    items = listEvents_('primary', Object.assign({ eventTypes: ['birthday'] }, range));
  } catch (e) {
    console.warn('Дни рождения в основном календаре недоступны: ' + e.message);
  }
  for (let i = 0; !items.length && i < CONTACTS_BIRTHDAY_CALENDARS.length; i++) {
    try {
      items = listEvents_(CONTACTS_BIRTHDAY_CALENDARS[i], range);
    } catch (e) {
      // Такого календаря у аккаунта нет — пробуем следующий.
    }
  }

  return items
    .map(function (ev) {
      return {
        date: ev.start.date || dayKey_(new Date(ev.start.dateTime)),
        name: ev.summary || '',
        self: Boolean(ev.birthdayProperties && ev.birthdayProperties.type === 'self'),
      };
    })
    .sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : 0; });
}

function listCalendarIds_() {
  const setting = CONFIG.calendar.calendars;
  if (Array.isArray(setting)) return setting;

  const ids = [];
  let pageToken;
  do {
    const opts = { maxResults: 250 };
    if (pageToken) opts.pageToken = pageToken;
    const page = Calendar.CalendarList.list(opts);
    (page.items || []).forEach(function (c) {
      // Галочки ставятся в веб-версии; основной календарь берём всегда.
      if (c.selected || c.primary) ids.push(c.id);
    });
    pageToken = page.nextPageToken;
  } while (pageToken);
  return ids;
}

/** Все события календаря за период, повторяющиеся развёрнуты в отдельные. */
function listEvents_(calendarId, params) {
  const items = [];
  let pageToken;
  do {
    const opts = Object.assign({ singleEvents: true, orderBy: 'startTime', maxResults: 250 }, params);
    if (pageToken) opts.pageToken = pageToken;
    const page = Calendar.Events.list(calendarId, opts);
    items.push.apply(items, page.items || []);
    pageToken = page.nextPageToken;
  } while (pageToken);
  return items;
}

function isDeclined_(ev) {
  return (ev.attendees || []).some(function (a) {
    return a.self && a.responseStatus === 'declined';
  });
}
