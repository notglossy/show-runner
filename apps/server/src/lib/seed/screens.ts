export interface BuiltinScreen {
  id: string;
  name: string;
  description: string;
  html: string;
  dataRefreshSeconds: number;
}

export const BUILTIN_SCREENS: BuiltinScreen[] = [
  {
    id: "builtin-clock",
    name: "Clock",
    description: "Large clock with date and greeting.",
    dataRefreshSeconds: 300,
    html: `<style>
  .ck-root { position: fixed; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #000; color: #fff; font-family: system-ui, sans-serif; text-align: center; }
  .ck-greeting { font-size: 40px; font-weight: 400; color: #7d8595; margin-bottom: 24px; }
  .ck-row { display: flex; align-items: flex-start; }
  .ck-time { font-size: 290px; font-weight: 200; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; color: #fff; }
  .ck-ampm { font-size: 72px; font-weight: 400; color: #9aa3b2; margin-left: 20px; margin-top: 28px; }
  .ck-date { margin-top: 32px; font-size: 60px; font-weight: 400; color: #c9ced8; }
</style>
<main class="ck-root">
  <div class="ck-greeting" data-bind="time.greeting"></div>
  <div class="ck-row"><span class="ck-time" data-bind="time.hhmm"></span><span class="ck-ampm" data-bind="time.ampm"></span></div>
  <div class="ck-date" data-bind="time.date"></div>
</main>`,
  },
  {
    id: "builtin-clock-weather",
    name: "Clock & Weather",
    description: "Clock with current conditions and a 5-day forecast.",
    dataRefreshSeconds: 60,
    html: `<style>
  .cw-root { position: fixed; inset: 0; padding: 48px; background: #000; color: #fff; font-family: system-ui, sans-serif; display: flex; flex-direction: column; }
  .cw-top { display: flex; justify-content: space-between; align-items: flex-start; flex: 1; }
  .cw-clockrow { display: flex; align-items: flex-start; }
  .cw-time { font-size: 200px; font-weight: 300; line-height: 1; font-variant-numeric: tabular-nums; color: #fff; }
  .cw-ampm { font-size: 56px; font-weight: 400; color: #9aa3b2; margin-left: 14px; margin-top: 18px; }
  .cw-date { margin-top: 16px; font-size: 44px; color: #c9ced8; }
  .cw-now { text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
  .cw-emoji { font-size: 120px; line-height: 1; }
  .cw-temp { font-size: 150px; font-weight: 200; line-height: 1; font-variant-numeric: tabular-nums; color: #fff; }
  .cw-cond { font-size: 40px; color: #c9ced8; margin-top: 8px; }
  .cw-hilo { font-size: 34px; color: #9aa3b2; margin-top: 8px; font-variant-numeric: tabular-nums; }
  .cw-now[data-icon="rain"] .cw-cond, .cw-now[data-icon="showers"] .cw-cond, .cw-now[data-icon="drizzle"] .cw-cond { color: #7fb4ff; }
  .cw-now[data-icon="thunderstorm"] .cw-cond { color: #ffd166; }
  .cw-now[data-icon="snow"] .cw-cond, .cw-now[data-icon="sleet"] .cw-cond { color: #d8ecff; }
  .cw-now[data-icon="clear"] .cw-cond, .cw-now[data-icon="partly-cloudy"] .cw-cond { color: #ffcf7a; }
  .cw-band { display: grid; grid-template-columns: repeat(5, 1fr); gap: 24px; margin-top: 32px; }
  .cw-day { text-align: center; padding: 20px 0; border-radius: 24px; background: #0f1319; }
  .cw-name { font-size: 32px; color: #9aa3b2; }
  .cw-dayemoji { font-size: 64px; margin: 8px 0; line-height: 1.2; }
  .cw-temps { font-size: 40px; font-variant-numeric: tabular-nums; }
  .cw-low { color: #9aa3b2; margin-left: 12px; }
  .cw-empty { grid-column: 1 / -1; text-align: center; font-size: 36px; color: #9aa3b2; padding: 32px 0; }
</style>
<main class="cw-root">
  <div class="cw-top">
    <div>
      <div class="cw-clockrow"><span class="cw-time" data-bind="time.hhmm"></span><span class="cw-ampm" data-bind="time.ampm"></span></div>
      <div class="cw-date" data-bind="time.date"></div>
    </div>
    <div class="cw-now" data-bind-attr="data-icon:weather.current.icon">
      <div class="cw-emoji" data-bind="weather.current.emoji"></div>
      <div class="cw-temp"><span data-bind="weather.current.temperature"></span><span data-bind="weather.units.temperature"></span></div>
      <div class="cw-cond" data-bind="weather.current.condition" data-fallback="Weather unavailable"></div>
      <div class="cw-hilo">H <span data-bind="weather.today.high"></span>° · L <span data-bind="weather.today.low"></span>°</div>
    </div>
  </div>
  <section class="cw-band" id="cw-days"></section>
</main>
<script>
  var band = document.getElementById("cw-days");
  kiosk.on("data", function (data) {
    while (band.firstChild) { band.removeChild(band.firstChild); }
    var daily = (data && data.weather && data.weather.daily) || [];
    var forecast = daily.slice(1, 6);
    if (forecast.length < 5) {
      var empty = document.createElement("div");
      empty.className = "cw-empty";
      empty.textContent = "Forecast unavailable";
      band.appendChild(empty);
      return;
    }
    for (var i = 0; i < forecast.length; i++) {
      var d = forecast[i];
      var card = document.createElement("div");
      card.className = "cw-day";
      var name = document.createElement("div");
      name.className = "cw-name";
      name.textContent = d.weekdayShort;
      var emoji = document.createElement("div");
      emoji.className = "cw-dayemoji";
      emoji.textContent = d.emoji;
      var temps = document.createElement("div");
      temps.className = "cw-temps";
      var high = document.createElement("span");
      high.textContent = d.high;
      var low = document.createElement("span");
      low.className = "cw-low";
      low.textContent = d.low;
      temps.appendChild(high);
      temps.appendChild(document.createTextNode("°"));
      temps.appendChild(low);
      var lowSuffix = document.createTextNode("°");
      temps.appendChild(lowSuffix);
      card.appendChild(name);
      card.appendChild(emoji);
      card.appendChild(temps);
      band.appendChild(card);
    }
    kiosk.applyBindings(band);
  });
</script>`,
  },
];
