export interface BuiltinScreen {
  id: string;
  name: string;
  description: string;
  html: string;
  dataRefreshSeconds: number;
}

export const BUILTIN_SCREENS: BuiltinScreen[] = [
  {
    id: 'builtin-clock',
    name: 'Clock',
    description: 'Large clock with date and greeting.',
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
    id: 'builtin-clock-weather',
    name: 'Clock & Weather',
    description: 'Clock with current conditions and a 5-day forecast.',
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
  {
    id: 'builtin-dial',
    name: 'Dial',
    description:
      'Analog dial with a sweeping second hand, current conditions, a sunrise-to-sunset arc and the next 12 hours of temperature.',
    dataRefreshSeconds: 60,
    html: `<style>
  @property --fg {
    syntax: "<color>";
    inherits: true;
    initial-value: #f2f0ea;
  }
  @property --bg {
    syntax: "<color>";
    inherits: true;
    initial-value: #0b0b0c;
  }

  .screen {
    position: fixed;
    inset: 0;
    --fg: #f2f0ea;
    --bg: #0b0b0c;
    background-color: var(--bg);
    color: var(--fg);
    transition: --fg 2s linear, --bg 2s linear, background-color 2s linear, color 2s linear;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 40px;
    padding: 0 80px;
    font-family: "Inter", system-ui, sans-serif;
  }
  .screen[data-day="false"] {
    --fg: #e8e6df;
    --bg: #0a0a0f;
  }

  [data-bind-missing] { opacity: 0.5; }

  /* ---------- clock ---------- */
  .clockcol {
    flex: 1 1 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }
  .dial { display: block; width: 620px; height: 620px; }

  .tick-min { stroke: #3a3a3a; stroke-width: 2; }
  .tick-hour { stroke: var(--fg); stroke-width: 5; }

  .hand {
    stroke: var(--fg);
    stroke-linecap: butt;
    transform-box: view-box;
    transform-origin: 310px 310px;
  }
  .hand--sec {
    stroke: #f5a623;
    transition: transform 1s linear;
  }
  .cap { fill: #f5a623; }

  .readout {
    margin-top: 14px;
    font-size: 30px;
    font-weight: 500;
    line-height: 1.2;
    letter-spacing: 0.3em;
    text-indent: 0.3em;
    color: #8a8a8a;
    font-variant-numeric: tabular-nums lining-nums;
  }

  /* ---------- weather column ---------- */
  .wx {
    flex: 0 0 400px;
    width: 400px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
  }
  .screen[data-weather="off"] .wx { display: none; }

  .temp {
    display: flex;
    align-items: flex-start;
    font-size: 200px;
    font-weight: 200;
    line-height: 0.78;
    letter-spacing: -0.02em;
    white-space: nowrap;
    color: var(--fg);
    font-variant-numeric: tabular-nums lining-nums;
  }
  .temp__unit {
    font-size: 72px;
    font-weight: 200;
    line-height: 1.1;
    letter-spacing: 0;
    margin-left: 8px;
  }

  .cond {
    margin-top: 12px;
    font-size: 36px;
    font-weight: 400;
    line-height: 1.1;
    color: #8a8a8a;
  }

  .sun { display: block; margin-top: 28px; }
  .sun__arc { fill: none; stroke: #333333; stroke-width: 1; }
  .sun__dot { fill: #f5a623; }
  .sun__labels {
    width: 376px;
    display: flex;
    justify-content: space-between;
    margin-top: 2px;
    font-size: 26px;
    line-height: 1.2;
    color: #8a8a8a;
    font-variant-numeric: tabular-nums lining-nums;
  }

  .spark { display: block; margin-top: 26px; }
  .spark__line {
    fill: none;
    stroke: var(--fg);
    stroke-width: 2;
    stroke-linejoin: round;
    stroke-linecap: round;
  }
  .spark__labels {
    width: 360px;
    display: flex;
    justify-content: space-between;
    margin-top: 6px;
    font-size: 24px;
    line-height: 1.25;
    color: #8a8a8a;
  }

  .hl {
    margin-top: 22px;
    font-size: 32px;
    line-height: 1.25;
    color: #8a8a8a;
    font-variant-numeric: tabular-nums lining-nums;
  }
  .hl .sep { padding: 0 20px; }
</style>

<main class="screen" id="screen" data-bind-attr="data-day:weather.current.isDay">
  <section class="clockcol">
    <svg class="dial" width="620" height="620" viewBox="0 0 620 620" aria-hidden="true">
      <g id="ticks"></g>
      <line class="hand" id="handHour" x1="310" y1="310" x2="310" y2="160" stroke-width="14"></line>
      <line class="hand" id="handMin" x1="310" y1="310" x2="310" y2="80" stroke-width="8"></line>
      <g class="hand hand--sec" id="handSec">
        <line x1="310" y1="310" x2="310" y2="50" stroke-width="2"></line>
        <line x1="310" y1="310" x2="310" y2="350" stroke-width="2"></line>
      </g>
      <circle class="cap" cx="310" cy="310" r="5"></circle>
    </svg>
    <div class="readout" data-bind="time.hhmm24"></div>
  </section>

  <aside class="wx">
    <div class="temp">
      <span data-bind="weather.current.temperature"></span>
      <span class="temp__unit" data-bind="weather.units.temperature"></span>
    </div>
    <div class="cond" data-bind="weather.current.condition" data-fallback="Weather unavailable"></div>

    <svg class="sun" width="376" height="196" viewBox="-8 -8 376 196" aria-hidden="true">
      <path class="sun__arc" d="M 0 180 A 180 180 0 0 1 360 180"></path>
      <circle class="sun__dot" id="sunDot" cx="0" cy="180" r="7"></circle>
    </svg>
    <div class="sun__labels">
      <span data-bind="weather.today.sunrise"></span>
      <span data-bind="weather.today.sunset"></span>
    </div>

    <svg class="spark" width="360" height="90" viewBox="0 0 360 90" aria-hidden="true">
      <path class="spark__line" id="sparkLine" d=""></path>
    </svg>
    <div class="spark__labels">
      <span id="sparkStart"></span>
      <span id="sparkEnd"></span>
    </div>

    <div class="hl">
      H <span data-bind="weather.today.high"></span>°<span class="sep"></span>L
      <span data-bind="weather.today.low"></span>°
    </div>
  </aside>
</main>

<script>
  (function () {
    const screenEl = document.getElementById("screen");
    const handHour = document.getElementById("handHour");
    const handMin = document.getElementById("handMin");
    const handSec = document.getElementById("handSec");
    const sunDot = document.getElementById("sunDot");
    const sparkLine = document.getElementById("sparkLine");
    const sparkStart = document.getElementById("sparkStart");
    const sparkEnd = document.getElementById("sparkEnd");
    const ticks = document.getElementById("ticks");

    const CX = 310;
    const CY = 310;

    /* dial ticks (markup built from numbers only) */
    let tickMarkup = "";
    for (let i = 0; i < 60; i++) {
      const major = i % 5 === 0;
      const a = (i * 6 * Math.PI) / 180;
      const rOut = 302;
      const rIn = major ? 276 : 292;
      const x1 = (CX + Math.sin(a) * rIn).toFixed(2);
      const y1 = (CY - Math.cos(a) * rIn).toFixed(2);
      const x2 = (CX + Math.sin(a) * rOut).toFixed(2);
      const y2 = (CY - Math.cos(a) * rOut).toFixed(2);
      tickMarkup +=
        '<line class="' + (major ? "tick-hour" : "tick-min") + '" x1="' + x1 +
        '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"></line>';
    }
    ticks.innerHTML = tickMarkup;

    /* second hand: cumulative angle so the sweep never runs backwards; it
       re-syncs to t.second on every tick so a late or skipped tick does not drift */
    let secondDeg = null;

    /* sun arc geometry (top half of a circle, centre + radius) */
    const SUN_CX = 180;
    const SUN_CY = 180;
    const SUN_R = 180;

    function updateSun(nowMs) {
      const start = Date.parse(kiosk.get("weather.today.sunriseIso"));
      const end = Date.parse(kiosk.get("weather.today.sunsetIso"));
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        !Number.isFinite(nowMs) ||
        !(end > start)
      ) {
        sunDot.style.opacity = "0";
        return;
      }
      sunDot.style.opacity = "1";
      const raw = (nowMs - start) / (end - start);
      const f = Math.min(1, Math.max(0, raw));
      const angle = Math.PI * (1 - f);
      const x = SUN_CX + SUN_R * Math.cos(angle);
      const y = SUN_CY - SUN_R * Math.sin(angle);
      sunDot.setAttribute("cx", x.toFixed(1));
      sunDot.setAttribute("cy", y.toFixed(1));
      sunDot.setAttribute("fill", raw >= 0 && raw <= 1 ? "#f5a623" : "#5a4a2a");
    }

    /* hourly temperature curve */
    function drawSpark(hours) {
      const pts = (hours || []).filter(function (h) {
        return h && typeof h.temperature === "number";
      });
      if (pts.length < 2) {
        sparkLine.setAttribute("d", "");
        sparkStart.textContent = "";
        sparkEnd.textContent = "";
        return;
      }
      const temps = pts.map(function (p) { return p.temperature; });
      const min = Math.min.apply(null, temps);
      const max = Math.max.apply(null, temps);
      const flat = max === min;
      const stepX = 358 / (pts.length - 1);
      let d = "";
      temps.forEach(function (v, i) {
        const x = 1 + i * stepX;
        const y = flat ? 45 : 81 - ((v - min) / (max - min)) * 72;
        d += (i ? " L " : "M ") + x.toFixed(1) + " " + y.toFixed(1);
      });
      sparkLine.setAttribute("d", d);
      sparkStart.textContent = pts[0].hour || "";
      sparkEnd.textContent = pts[pts.length - 1].hour || "";
    }

    kiosk.on("tick", function (t) {
      const seconds = Number(t.second) || 0;
      const minutes = Number(t.minute) || 0;
      const hours = (Number(t.hour24) || 0) % 12;

      const hourDeg = hours * 30 + minutes * 0.5;
      const minuteDeg = minutes * 6 + seconds * 0.1;

      handHour.style.transform = "rotate(" + hourDeg.toFixed(3) + "deg)";
      handMin.style.transform = "rotate(" + minuteDeg.toFixed(3) + "deg)";

      const target = seconds * 6;
      if (secondDeg === null) {
        secondDeg = target;
        handSec.style.transition = "none";
        handSec.style.transform = "rotate(" + secondDeg + "deg)";
        handSec.getBoundingClientRect();
        handSec.style.transition = "";
      } else {
        let delta = target - (secondDeg % 360);
        if (delta < 0) delta += 360;
        if (delta > 0) {
          secondDeg += delta;
          handSec.style.transform = "rotate(" + secondDeg + "deg)";
        }
      }

      updateSun(Number(t.epochMs));
    });

    kiosk.on("data", function (data) {
      const w = data && data.weather;
      const ok = !!(w && w.available && w.current);
      screenEl.setAttribute("data-weather", ok ? "on" : "off");

      updateSun(Number(kiosk.get("time.epochMs")));
      drawSpark(w ? w.hourly : []);
    });
  })();
</script>`,
  },
];
