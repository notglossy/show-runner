# Clock & Weather

![Clock & Weather screen](screenshot.png)

Time and current temperature side by side at the same size, with the date and location above and the
greeting and conditions below. A 5-day forecast runs along the bottom with a line icon, high and low,
and the chance of rain when it's 20% or more.

- **Data refresh:** 60 seconds
- **Template:** [`screen.html`](screen.html)

## Data it uses

| Field | Shown as |
|---|---|
| `time.date`, `time.hhmm`, `time.ampm`, `time.greeting` | Date, clock and greeting |
| `weather.location.name` | Location, top right |
| `weather.current.temperature`, `weather.units.temperature`, `weather.current.condition`, `weather.current.icon` | Current temperature, icon and conditions |
| `weather.today.high`, `weather.today.low` | Today's high and low |
| `weather.daily[1..5]` (`weekdayShort`, `icon`, `high`, `low`, `precipitationChance`) | The forecast, built by the script on each data refresh |

## Restyling

```css
:root {
  --cw-accent: #a995ff; /* weather icons and the date */
}
```

## Notes

- The icons are inline SVG line drawings, one per weather `icon` key (clear, partly-cloudy, cloudy, fog,
  drizzle, rain, showers, sleet, snow, thunderstorm). They come from a fixed table in the template and
  are drawn in `currentColor`, so they follow `--cw-accent`.
- If fewer than five forecast days are available, the forecast area shows "Forecast unavailable".
- Long location names are cut off with "…" so they never push into the temperature.
