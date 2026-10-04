import { escapeHtml } from './document';
import { LOGO_SVG } from './logo';

// Brand palette from the dashboard theme (app/globals.css): signal violet, signal-tint for violet text on black.
// Space Grotesk and JetBrains Mono come from the kiosk fonts the document shell declares.
const SYSTEM_CSS = `
<style>
  .sys { position: fixed; inset: 0; background: #000; color: #f2f2f2;
         font-family: "Space Grotesk", system-ui, sans-serif; font-weight: 500; }
  .sys-mono { font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 400; text-transform: uppercase;
              letter-spacing: -0.01em; }
  .sys-logo { position: absolute; top: 56px; left: 64px; height: 32px; width: auto; }
  .sys-clock { position: absolute; top: 56px; right: 64px; font-size: 28px; line-height: 32px; color: #8b8b8b;
               font-variant-numeric: tabular-nums; }
  .sys-id { position: absolute; bottom: 40px; left: 64px; font-size: 16px; color: #3d3d3d;
            font-family: "JetBrains Mono", ui-monospace, monospace; }

  .sys-pair { position: absolute; left: 64px; right: 64px; top: 50%; transform: translateY(-46%); }
  .sys-pair-label { font-size: 26px; color: #a995ff; margin: 0 0 28px; }
  .sys-code { display: flex; gap: 14px; margin: 0 0 44px; }
  .sys-code span { width: 132px; height: 176px; display: grid; place-items: center; border: 3px solid #6136f5;
                   font-family: "JetBrains Mono", ui-monospace, monospace; font-weight: 500; font-size: 120px;
                   color: #fff; }
  .sys-steps { display: flex; gap: 56px; font-size: 22px; color: #8b8b8b; margin: 0; }
  .sys-steps b { color: #f2f2f2; font-weight: 400; margin-right: 12px; }

  .sys-split { position: absolute; inset: 0; display: grid; grid-template-columns: 3fr 2fr; }
  .sys-split-left { position: relative; }
  .sys-time { position: absolute; left: 64px; top: 50%; transform: translateY(-50%); display: flex;
              align-items: flex-start; }
  .sys-time-hm { font-size: 220px; line-height: 0.9; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }
  .sys-time-ampm { font-size: 44px; color: #8b8b8b; margin: 18px 0 0 18px; }
  .sys-panel { background: #6136f5; color: #fff; padding: 56px; display: flex; flex-direction: column;
               justify-content: space-between; }
  .sys-panel-label { font-size: 24px; color: #e6e0ff; margin: 0; }
  .sys-name { font-size: 64px; line-height: 1.05; letter-spacing: -0.02em; margin: 0 0 20px;
              overflow-wrap: anywhere; }
  .sys-msg { font-size: 30px; line-height: 1.3; margin: 0; }
  .sys-hint { font-size: 22px; line-height: 1.5; color: #e6e0ff; margin: 0; padding-top: 24px;
              border-top: 1px solid rgba(255, 255, 255, 0.35); overflow-wrap: anywhere; }
</style>`;

/** Body fragment showing the pairing code for an unclaimed device. */
export function pairingScreen(pairingCode: string, deviceId: string): string {
  const boxes = [...pairingCode].map((c) => `<span>${escapeHtml(c)}</span>`).join('');
  return `${SYSTEM_CSS}
<div class="sys">
  ${LOGO_SVG}
  <div class="sys-clock sys-mono"><span data-bind="time.hhmm"></span> <span data-bind="time.ampm"></span></div>
  <main class="sys-pair">
    <p class="sys-pair-label sys-mono">Pairing code</p>
    <div class="sys-code" aria-label="${escapeHtml(pairingCode)}">${boxes}</div>
    <p class="sys-steps sys-mono"><span><b>01</b>Open the dashboard</span><span><b>02</b>Go to Devices</span><span><b>03</b>Enter this code</span></p>
  </main>
  <div class="sys-id">${escapeHtml(deviceId)}</div>
</div>`;
}

/** Body fragment shown when a device has no screen or playlist assigned. */
export function unassignedScreen(name: string | null, deviceId: string): string {
  const display = escapeHtml(name ?? 'This display');
  return `${SYSTEM_CSS}
<div class="sys"><div class="sys-split">
  <div class="sys-split-left">
    ${LOGO_SVG}
    <div class="sys-time"><span class="sys-time-hm" data-bind="time.hhmm"></span><span class="sys-time-ampm sys-mono" data-bind="time.ampm"></span></div>
    <div class="sys-id">${escapeHtml(deviceId)}</div>
  </div>
  <main class="sys-panel">
    <p class="sys-panel-label sys-mono">Display</p>
    <div><p class="sys-name">${display}</p><p class="sys-msg">No screen assigned yet.</p></div>
    <p class="sys-hint sys-mono">Dashboard → Devices → ${display}<br>Pick a screen or playlist</p>
  </main>
</div></div>`;
}
