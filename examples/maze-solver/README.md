# Maze Solver

![Maze Solver screen](screenshot.png)

Every minute a new 21×21 maze is generated and a depth-first search works its way from START to EXIT,
backtracking out of dead ends as it goes. At :51 the search stops and the solved route lights up green until
the next minute's maze. The left side shows the time with live seconds, the date, the solver's status and
progress, and a one-line weather summary.

Not a built-in screen: add it from the dashboard to use it.

- **Data refresh:** 60 seconds
- **Template:** [`screen.html`](screen.html)

## Data it uses

| Field | Shown as |
|---|---|
| `time.hhmm`, `time.ampm`, `time.date` | Clock and date |
| `time.hour24`, `time.minute`, `time.second` (via `kiosk.on("tick")`) | Seconds readout, the maze for each minute and the solver's progress |
| `weather.current.temperature`, `weather.units.temperature`, `weather.current.condition` | Weather line |
| `weather.today.high`, `weather.today.low` | High and low, right end of the weather line |

## Restyling

The interface colors are CSS variables at the top of the `<style>` block:

```css
:root {
  --bg: #070a12;
  --panel-bg: #0d1322;
  --cyan: #06b6d4;    /* badge, seconds, searching state */
  --emerald: #10b981; /* start, solved state */
  --amber: #f59e0b;   /* exit */
  /* … */
}
```

The maze itself is drawn on a canvas, so its colors (walls `#162032`, the search trail `#38bdf8`, the solved
route `#34d399`) are in `drawMaze()` in the script. `COLS` and `ROWS` set the maze size; keep them odd.

## Notes

- Everything is driven by the runtime's once-a-second `tick`, so it only redraws once a second, which is
  gentle on an always-on display.
- The maze is seeded from the time of day, so a given minute always produces the same maze.
- The search and the solution are planned up front each minute, then played back over 50 seconds.
