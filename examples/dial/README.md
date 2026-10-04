# Dial

![Dial screen](screenshot.png)

An analog clock with a sweeping second hand and a 24-hour digital readout, next to the current
temperature and conditions, a sun that moves along an arc from sunrise to sunset, the next 12 hours of
temperature as a line, and today's high and low.

- **Data refresh:** 60 seconds
- **Template:** [`screen.html`](screen.html)

## Data it uses

| Field | Shown as |
|---|---|
| `time.hour24`, `time.minute`, `time.second` (via `kiosk.on("tick")`) | The hands |
| `time.hhmm24` | Digital readout under the dial |
| `time.epochMs` | Sun position |
| `weather.current.temperature`, `weather.units.temperature`, `weather.current.condition` | Current temperature and conditions |
| `weather.current.isDay` | Day/night tone (`data-day` on the screen) |
| `weather.today.sunrise`, `weather.today.sunset`, `weather.today.sunriseIso`, `weather.today.sunsetIso` | Sun arc and its labels |
| `weather.hourly[]` (`temperature`, `hour`) | The 12-hour temperature line |
| `weather.today.high`, `weather.today.low` | High and low |

## Restyling

```css
:root {
  --dl-accent: #a995ff; /* second hand, centre cap, sun */
  --dl-accent-dim: #3b3166; /* sun before sunrise and after sunset */
}
```

## Notes

- The second hand keeps a running angle so it always sweeps forward, and re-syncs to the real second
  on every tick, so a late or skipped tick doesn't make it drift.
- When weather is unavailable, the whole weather column hides and the dial stays centered.
