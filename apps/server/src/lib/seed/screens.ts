export interface BuiltinScreen {
  id: string;
  name: string;
  description: string;
  html: string;
  dataRefreshSeconds: number;
}

// TEMPORARY placeholder until the designed seed screens land.
export const BUILTIN_SCREENS: BuiltinScreen[] = [
  {
    id: "builtin-clock",
    name: "Clock",
    description: "Large clock with date.",
    dataRefreshSeconds: 300,
    html: `<main style="display:grid;place-items:center;height:100vh;font-family:system-ui">
  <div style="text-align:center"><div style="font-size:300px" data-bind="time.hhmm"></div>
  <div style="font-size:60px" data-bind="time.date"></div></div></main>`,
  },
];
