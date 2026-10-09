// Коды погоды WMO, которые возвращает Open-Meteo: [эмодзи, описание].
const WEATHER_CODES = {
  0: ['☀️', 'ясно'],
  1: ['🌤', 'преимущественно ясно'],
  2: ['⛅', 'переменная облачность'],
  3: ['☁️', 'пасмурно'],
  45: ['🌫', 'туман'],
  48: ['🌫', 'туман с изморозью'],
  51: ['🌦', 'лёгкая морось'],
  53: ['🌦', 'морось'],
  55: ['🌦', 'сильная морось'],
  56: ['🌧', 'ледяная морось'],
  57: ['🌧', 'ледяная морось'],
  61: ['🌧', 'небольшой дождь'],
  63: ['🌧', 'дождь'],
  65: ['🌧', 'сильный дождь'],
  66: ['🌧', 'ледяной дождь'],
  67: ['🌧', 'ледяной дождь'],
  71: ['🌨', 'небольшой снег'],
  73: ['🌨', 'снег'],
  75: ['❄️', 'сильный снег'],
  77: ['🌨', 'снежная крупа'],
  80: ['🌦', 'кратковременный дождь'],
  81: ['🌧', 'ливни'],
  82: ['⛈', 'сильные ливни'],
  85: ['🌨', 'снегопад'],
  86: ['❄️', 'сильный снегопад'],
  95: ['⛈', 'гроза'],
  96: ['⛈', 'гроза с градом'],
  99: ['⛈', 'гроза с сильным градом'],
};

/** Прогноз на сегодня из Open-Meteo: бесплатно и без ключа. */
function fetchWeather_() {
  const w = CONFIG.weather;
  const url = 'https://api.open-meteo.com/v1/forecast'
    + '?latitude=' + w.latitude
    + '&longitude=' + w.longitude
    + '&current=temperature_2m,apparent_temperature,weather_code'
    + '&hourly=temperature_2m,precipitation_probability,weather_code,wind_gusts_10m'
    + '&timezone=' + encodeURIComponent(CONFIG.timeZone)
    + '&forecast_days=1';
  return fetchJson_(url);
}

/** Open-Meteo иногда отвечает «The service is overloaded», поэтому пробуем несколько раз. */
function fetchJson_(url, attempts) {
  attempts = attempts || 3;
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
      const data = JSON.parse(res.getContentText());
      if (res.getResponseCode() === 200 && !data.error) return data;
      lastError = new Error(data.reason || 'HTTP ' + res.getResponseCode());
    } catch (e) {
      lastError = e;
    }
    if (i < attempts) Utilities.sleep(2000 * i);
  }
  throw lastError;
}

/**
 * Сводит прогноз к тому, что важно на остаток дня: часы с текущего до
 * dayEndHour. Ночной дождь, который уже закончился, не учитывается.
 */
function summarizeWeather_(data, cfg) {
  const nowHour = Number(data.current.time.slice(11, 13));
  const h = data.hourly;
  const all = h.time.map(function (time, i) {
    return {
      hour: Number(time.slice(11, 13)),
      temp: h.temperature_2m[i],
      rain: h.precipitation_probability[i] || 0,
      code: h.weather_code[i],
      gust: h.wind_gusts_10m[i] || 0,
    };
  });

  let hours = all.filter(function (x) { return x.hour >= nowHour && x.hour <= cfg.dayEndHour; });
  if (!hours.length) hours = all.filter(function (x) { return x.hour >= nowHour; });
  if (!hours.length) hours = all;

  const temps = hours.map(function (x) { return x.temp; }).filter(function (t) { return t != null; });
  if (!temps.length) temps.push(data.current.temperature_2m);
  const rainy = hours.filter(function (x) { return x.rain >= cfg.rainThreshold; });
  const maxGust = Math.max.apply(null, hours.map(function (x) { return x.gust; }));

  return {
    nowTemp: data.current.temperature_2m,
    feelsLike: data.current.apparent_temperature,
    minTemp: Math.min.apply(null, temps),
    maxTemp: Math.max.apply(null, temps),
    code: pickWeatherCode_(hours, rainy),
    rain: rainy.length ? describeRainWindow_(rainy, hours) : null,
    gust: maxGust >= cfg.windGustThreshold ? Math.round(maxGust) : null,
  };
}

/**
 * Если днём ждём осадки — показываем самые сильные из них. Иначе самую
 * частую облачность: код осадков с низкой вероятностью считаем «пасмурно».
 */
function pickWeatherCode_(hours, rainy) {
  const precip = rainy.map(function (x) { return x.code; }).filter(isPrecipitation_);
  if (precip.length) return Math.max.apply(null, precip);

  const counts = {};
  let best = 3;
  let bestCount = 0;
  hours.forEach(function (x) {
    const code = isPrecipitation_(x.code) ? 3 : x.code;
    counts[code] = (counts[code] || 0) + 1;
    if (counts[code] > bestCount) {
      best = code;
      bestCount = counts[code];
    }
  });
  return best;
}

/** 'с 15:00 до 18:00', 'до 11:00', 'с 18:00 и до ночи' или 'весь день'. */
function describeRainWindow_(rainy, hours) {
  const from = rainy[0].hour;
  const to = rainy[rainy.length - 1].hour + 1;
  const dayStart = hours[0].hour;
  const dayEnd = hours[hours.length - 1].hour + 1;
  if (from <= dayStart && to >= dayEnd) return 'весь день';
  if (from <= dayStart) return 'до ' + pad2_(to) + ':00';
  if (to >= dayEnd) return 'с ' + pad2_(from) + ':00 и до ночи';
  return 'с ' + pad2_(from) + ':00 до ' + pad2_(to) + ':00';
}

function formatWeather_(w, city) {
  const info = WEATHER_CODES[w.code] || ['🌡', ''];
  let line = info[0] + ' <b>' + escapeHtml_(city) + '</b>: сейчас ' + formatTemp_(w.nowTemp) + '°';
  if (Math.abs(w.feelsLike - w.nowTemp) >= 2) line += ' (ощущается ' + formatTemp_(w.feelsLike) + '°)';
  line += ', днём ' + formatTempRange_(w.minTemp, w.maxTemp);

  const lines = [line];
  if (info[1]) lines.push(capitalize_(info[1]));
  if (w.rain) {
    lines.push(isSnow_(w.code) ? '❄️ Снег вероятен ' + w.rain : '🌂 Возьми зонт: дождь вероятен ' + w.rain);
  }
  if (w.gust) lines.push('💨 Порывы ветра до ' + w.gust + ' км/ч');
  return lines.join('\n');
}

function isPrecipitation_(code) {
  return code >= 51;
}

function isSnow_(code) {
  return (code >= 71 && code <= 77) || code === 85 || code === 86;
}

/** '+12', '−3', '0' — со знаком, как в прогнозах. */
function formatTemp_(t) {
  const r = Math.round(t);
  if (r > 0) return '+' + r;
  if (r < 0) return '−' + Math.abs(r);
  return '0';
}

/** '+10…+14°' или '+12°', если разброса нет. */
function formatTempRange_(min, max) {
  const a = formatTemp_(min);
  const b = formatTemp_(max);
  return a === b ? a + '°' : a + '…' + b + '°';
}

function pad2_(n) {
  return n < 10 ? '0' + n : String(n);
}
