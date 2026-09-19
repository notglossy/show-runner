/** Icon keys a template can switch on. Stable contract, documented in docs/screen-authoring.md. */
export type WeatherIcon =
  | 'clear'
  | 'partly-cloudy'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'showers'
  | 'sleet'
  | 'snow'
  | 'thunderstorm'
  | 'unknown';

interface CodeInfo {
  condition: string;
  icon: WeatherIcon;
  emojiDay: string;
  emojiNight: string;
}

const info = (
  condition: string,
  icon: WeatherIcon,
  emojiDay: string,
  emojiNight = emojiDay,
): CodeInfo => ({
  condition,
  icon,
  emojiDay,
  emojiNight,
});

// WMO weather interpretation codes, as used by Open-Meteo.
const CODES: Record<number, CodeInfo> = {
  0: info('Clear', 'clear', '☀️', '🌙'),
  1: info('Mostly clear', 'partly-cloudy', '🌤️', '🌙'),
  2: info('Partly cloudy', 'partly-cloudy', '⛅', '☁️'),
  3: info('Overcast', 'cloudy', '☁️'),
  45: info('Fog', 'fog', '🌫️'),
  48: info('Freezing fog', 'fog', '🌫️'),
  51: info('Light drizzle', 'drizzle', '🌦️', '🌧️'),
  53: info('Drizzle', 'drizzle', '🌦️', '🌧️'),
  55: info('Heavy drizzle', 'drizzle', '🌧️'),
  56: info('Freezing drizzle', 'sleet', '🌧️'),
  57: info('Freezing drizzle', 'sleet', '🌧️'),
  61: info('Light rain', 'rain', '🌧️'),
  63: info('Rain', 'rain', '🌧️'),
  65: info('Heavy rain', 'rain', '🌧️'),
  66: info('Freezing rain', 'sleet', '🌧️'),
  67: info('Freezing rain', 'sleet', '🌧️'),
  71: info('Light snow', 'snow', '🌨️'),
  73: info('Snow', 'snow', '🌨️'),
  75: info('Heavy snow', 'snow', '❄️'),
  77: info('Snow grains', 'snow', '🌨️'),
  80: info('Light showers', 'showers', '🌦️', '🌧️'),
  81: info('Showers', 'showers', '🌧️'),
  82: info('Heavy showers', 'showers', '⛈️'),
  85: info('Snow showers', 'snow', '🌨️'),
  86: info('Heavy snow showers', 'snow', '❄️'),
  95: info('Thunderstorm', 'thunderstorm', '⛈️'),
  96: info('Thunderstorm with hail', 'thunderstorm', '⛈️'),
  99: info('Thunderstorm with hail', 'thunderstorm', '⛈️'),
};

export function describeWeatherCode(code: number, isDay = true) {
  const c = CODES[code] ?? info('Unknown', 'unknown', '❔');
  return {
    weatherCode: code,
    condition: c.condition,
    icon: c.icon,
    emoji: isDay ? c.emojiDay : c.emojiNight,
  };
}
