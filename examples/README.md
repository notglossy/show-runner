# Example screens

The four screens ShowRunner ships with, as copy-and-paste templates. Each folder has the template
(`screen.html`), a 1280×800 screenshot, and a README covering the data it uses and how to restyle it.

| | Screen | What it shows |
|---|---|---|
| <img src="default/screenshot.png" width="240" alt="Default screen"> | [**Default**](default/) | Big clock and greeting on black; today's weather and a 3-day outlook on a violet panel. New displays start here. |
| <img src="clock/screenshot.png" width="240" alt="Clock screen"> | [**Clock**](clock/) | A centered clock with the date and greeting, and a bar that fills over each minute. |
| <img src="clock-weather/screenshot.png" width="240" alt="Clock & Weather screen"> | [**Clock & Weather**](clock-weather/) | Time and current temperature side by side, with a 5-day forecast in line icons. |
| <img src="dial/screenshot.png" width="240" alt="Dial screen"> | [**Dial**](dial/) | An analog clock with a sweeping second hand, the sun's position between sunrise and sunset, and the next 12 hours of temperature. |

Screenshots show Sunday, October 4 at 10:42 AM with sample weather for Los Angeles.

## Using an example

These screens are already in your dashboard (they're seeded on first start). To start a new screen from
one instead:

1. In the dashboard, open **Screens → New screen**.
2. Give it a name and paste the contents of `screen.html` into the editor. The preview updates as you type.
3. Set **Data refresh (s)** to the value in the example's README, then **Create screen**.
4. Assign it to a display from **Devices**, or add it to a playlist.

Each template keeps its colors as CSS variables in a block at the top of its `<style>`, so restyling
usually means changing one or two lines. The full template contract (data fields, `data-bind`, the
`kiosk` runtime, fonts) is in [docs/screen-authoring.md](../docs/screen-authoring.md).

## Keeping these in sync

The built-in templates live in `apps/server/src/lib/seed/screens.ts`; the `screen.html` files here are
generated from them and a test fails if they drift. After changing a built-in screen, run:

```sh
pnpm --filter @showrunner/server examples
```

Screenshots and READMEs are updated by hand.
