# 3D Pipes

![3D Pipes screen](screenshot.png)

The classic 3D Pipes screensaver, drawn with WebGL: colored pipes grow and turn through a 3D grid, then the
scene fades out and starts over. A frosted card in the top-left corner shows the time, date, location and
current weather. Scanlines and a vignette finish the CRT look.

Not a built-in screen: add it from the dashboard to use it.

- **Data refresh:** 60 seconds
- **Template:** [`screen.html`](screen.html)

## Data it uses

| Field | Shown as |
|---|---|
| `time.hhmm`, `time.ampm`, `time.date` | Clock and date in the card |
| `weather.location.name` | Location, top right of the card (falls back to "Echo Show") |
| `weather.current.emoji`, `weather.current.temperature`, `weather.units.temperature`, `weather.current.condition` | Current weather |
| `weather.today.high`, `weather.today.low` | High and low |

The pipes don't use any data.

## Restyling

- **Pipe colors:** the `PALETTES` list in the script, as RGB values from 0 to 1.
- **Accent:** `#00d2d3` (the badge, its dot and AM/PM) in the `.hud__badge`, `.hud__badge::before` and
  `.hud__ampm` rules.
- **Density and pace:** `MAX_SEGMENTS` (how full the scene gets before it resets) and the `f % 2` check in
  `loop()` (a pipe step every other frame).

## Notes

- **It animates continuously.** The pipes advance about 30 times a second on a `requestAnimationFrame`
  loop, which goes beyond the authoring guide's advice for always-on screens (slow, subtle motion). It
  only draws the new segments each frame, so the load is modest, but it's best as a screensaver-style
  screen in a playlist rather than a display's only screen around the clock.
- **Needs WebGL.** Without it the canvas stays empty and only the card shows.
- The screenshot was rendered with software WebGL; on the Echo the pipes are drawn by the GPU.
