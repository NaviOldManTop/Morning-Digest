/**
 * Настройки утренней сводки.
 * Токен бота и chat id здесь не храним: они лежат в Script Properties (см. README).
 */
const CONFIG = {
  timeZone: 'Europe/Warsaw',
  sendHour: 8, // триггер Apps Script срабатывает в пределах ±15 минут от этого часа

  weather: {
    city: 'Варшава',
    latitude: 52.2297,
    longitude: 21.0122,
    dayEndHour: 22, // прогноз считаем с текущего часа до этого
    rainThreshold: 50, // % вероятности осадков, с которого советуем зонт
    windGustThreshold: 50, // км/ч, с которого предупреждаем о ветре
  },

  calendar: {
    // 'selected' — все календари, отмеченные галочкой в Google Календаре.
    // Или явный список: ['primary', 'xxxx@group.calendar.google.com']
    calendars: 'selected',
    birthdaysAheadDays: 7,
  },

  tasks: {
    deadlinesAheadDays: 7, // задачи Google Tasks со сроком не дальше стольких дней
  },
};
