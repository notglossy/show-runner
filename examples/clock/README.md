# Clock

![Clock screen](screenshot.png)

A centered clock on black: the date in violet above, the greeting below, and a thin violet bar along
the bottom edge that fills over each minute.

- **Data refresh:** 300 seconds (only the date and greeting come from data; the time updates every
  second on its own)
- **Template:** [`screen.html`](screen.html)

## Data it uses

| Field | Shown as |
|---|---|
| `time.date` | Date above the clock |
| `time.hhmm`, `time.ampm` | The clock |
| `time.greeting` | Greeting below the clock |
| `time.second` (via `kiosk.on("tick")`) | The minute bar |

## Restyling

Both colors are at the top of the `<style>` block:

```css
:root {
  --ck-accent: #6136f5; /* seconds bar */
  --ck-accent-text: #a995ff; /* date; a lighter tint so it stays readable on black */
}
```

## Notes

- The bar is driven by the runtime's once-a-second `tick` event and eases between seconds. At :00 it
  snaps back to empty instead of animating backwards.
