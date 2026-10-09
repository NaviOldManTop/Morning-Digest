/** Собирает текст сводки на день, в который попадает момент now. */
function buildDigest_(now) {
  const todayKey = dayKey_(now);
  return formatDigest_({
    todayKey: todayKey,
    weather: runBlock_('погода', function () { return summarizeWeather_(fetchWeather_(), CONFIG.weather); }),
    events: runBlock_('календарь', function () { return fetchTodayEvents_(todayKey, now); }),
    birthdays: runBlock_('дни рождения', function () { return fetchBirthdays_(todayKey); }),
    deadlines: runBlock_('дедлайны', function () { return fetchDeadlines_(todayKey); }),
  });
}

/** Ошибка в одном блоке не должна ронять всю сводку. */
function runBlock_(name, fn) {
  try {
    return { ok: true, value: fn() };
  } catch (e) {
    console.error('Блок «' + name + '» упал: ' + (e.stack || e));
    return { ok: false, error: String(e.message || e).slice(0, 200) };
  }
}

function formatDigest_(parts) {
  const sections = ['<b>Доброе утро!</b> ' + formatLongDate_(parts.todayKey)];

  sections.push(parts.weather.ok
    ? formatWeather_(parts.weather.value, CONFIG.weather.city)
    : '🌡 Погоду получить не удалось: ' + escapeHtml_(parts.weather.error));
  sections.push(formatEventsSection_(parts.events, parts.todayKey));

  const birthdays = formatBirthdaysSection_(parts.birthdays, parts.todayKey);
  if (birthdays) sections.push(birthdays);
  const deadlines = formatDeadlinesSection_(parts.deadlines, parts.todayKey);
  if (deadlines) sections.push(deadlines);

  return sections.join('\n\n');
}

function formatEventsSection_(block, todayKey) {
  const header = '📅 <b>Сегодня</b>';
  if (!block.ok) return header + '\nКалендарь недоступен: ' + escapeHtml_(block.error);
  if (!block.value.length) return header + '\nСобытий нет, день свободен';
  return header + '\n' + block.value.map(function (ev) {
    return '• ' + formatEventLine_(ev, todayKey);
  }).join('\n');
}

function formatEventLine_(ev, todayKey) {
  const title = escapeHtml_(ev.title);
  if (ev.allDay) return 'Весь день: ' + title;

  // Событие может начаться вчера или закончиться завтра.
  const startsToday = dayKey_(new Date(ev.start)) === todayKey;
  const endsToday = !ev.end || dayKey_(new Date(ev.end)) === todayKey;
  if (!startsToday && !endsToday) return 'Весь день: ' + title;
  if (!startsToday) return '<b>до ' + formatTime_(ev.end) + '</b> ' + title;
  if (!endsToday) return '<b>с ' + formatTime_(ev.start) + '</b> ' + title;

  let time = formatTime_(ev.start);
  if (ev.end && ev.end !== ev.start) time += '–' + formatTime_(ev.end);
  return '<b>' + time + '</b> ' + title;
}

/** null, если дней рождения нет — тогда раздел не показываем. */
function formatBirthdaysSection_(block, todayKey) {
  const header = '🎂 <b>Дни рождения</b>';
  if (!block.ok) return header + '\nНе удалось получить: ' + escapeHtml_(block.error);
  if (!block.value.length) return null;
  return header + '\n' + block.value.map(function (b) {
    const diff = daysBetween_(todayKey, b.date);
    let label = relativeDayLabel_(todayKey, b.date);
    if (diff >= 2) label += ' (через ' + diff + ' ' + plural_(diff, ['день', 'дня', 'дней']) + ')';
    return '• ' + label + ': ' + (b.self ? 'твой день рождения 🎉' : escapeHtml_(b.name));
  }).join('\n');
}

/** null, если дедлайнов нет — тогда раздел не показываем. */
function formatDeadlinesSection_(block, todayKey) {
  const header = '⏰ <b>Дедлайны</b>';
  if (!block.ok) return header + '\nНе удалось получить: ' + escapeHtml_(block.error);
  if (!block.value.length) return null;
  return header + '\n' + block.value.map(function (d) {
    const title = escapeHtml_(d.title);
    if (d.date < todayKey) return '• ❗ Просрочено с ' + formatDayMonth_(d.date) + ': ' + title;
    return '• ' + relativeDayLabel_(todayKey, d.date) + ': ' + title;
  }).join('\n');
}

/** Telegram в режиме HTML требует экранировать только эти три символа. */
function escapeHtml_(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
