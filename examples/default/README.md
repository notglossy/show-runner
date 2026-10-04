# Default

![Default screen](screenshot.png)

The screen every new display starts on. A big clock, the date and a greeting fill the black left
side; a violet panel on the right shows the location, current temperature and conditions, today's high
and low, and a 3-day outlook.

- **Data refresh:** 60 seconds
- **Template:** [`screen.html`](screen.html)

## Data it uses

| Field | Shown as |
|---|---|
| `time.date`, `time.hhmm`, `time.ampm`, `time.greeting` | Date, clock and greeting |
| `weather.location.name` | Location at the top of the panel |
| `weather.current.temperature`, `weather.units.temperature`, `weather.current.condition` | Current temperature and conditions |
| `weather.today.high`, `weather.today.low` | Today's high and low |
| `weather.daily[1..3]` (`weekdayShort`, `condition`, `high`, `low`) | The 3-day outlook, built by the script on each data refresh |

## Restyling

The panel color is the first rule in the `<style>` block:

```css
/* Weather panel color. Change it here to restyle the screen. */
:root { --mb-accent: #6136f5; }
```

The panel's light lavender text (`#e6e0ff`) is written directly in its rules; if you pick a very light
panel color, change that too so it stays readable.

## Notes

- The two columns are locked to a 3:2 split, so a wide time like 12:58 PM never squeezes the panel.
- Long forecast conditions are cut off with "…" rather than wrapping.
