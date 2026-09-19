import { escapeHtml } from './document';

const SYSTEM_CSS = `
<style>
  .sys { position: fixed; inset: 0; display: grid; place-items: center; text-align: center;
         font-family: system-ui, "Roboto", sans-serif; background: radial-gradient(circle at 50% 40%, #151a22, #000 70%); }
  .sys-clock { position: absolute; top: 36px; right: 48px; font-size: 40px; font-weight: 500; color: #8a93a3;
               font-variant-numeric: tabular-nums; }
  .sys-label { font-size: 36px; color: #8a93a3; letter-spacing: 0.02em; margin: 0 0 24px; }
  .sys-code { font-size: 180px; font-weight: 700; letter-spacing: 0.12em; margin: 0 0 32px; padding-left: 0.12em;
              font-family: "Roboto Mono", ui-monospace, monospace; color: #fff; }
  .sys-hint { font-size: 28px; color: #6b7382; margin: 0; }
  .sys-title { font-size: 72px; font-weight: 600; margin: 0 0 20px; }
  .sys-id { position: absolute; bottom: 28px; left: 0; right: 0; font-size: 18px; color: #3d4450;
            font-family: ui-monospace, monospace; }
</style>`;

export function pairingScreen(pairingCode: string, deviceId: string): string {
  return `${SYSTEM_CSS}
<div class="sys">
  <div class="sys-clock"><span data-bind="time.hhmm"></span> <span data-bind="time.ampm"></span></div>
  <main>
    <p class="sys-label">Pairing code</p>
    <p class="sys-code">${escapeHtml(pairingCode)}</p>
    <p class="sys-hint">Claim this display in the ShowRunner dashboard</p>
  </main>
  <div class="sys-id">${escapeHtml(deviceId)}</div>
</div>`;
}

export function unassignedScreen(name: string | null, deviceId: string): string {
  return `${SYSTEM_CSS}
<div class="sys">
  <main>
    <p class="sys-title"><span data-bind="time.hhmm"></span> <span data-bind="time.ampm"></span></p>
    <p class="sys-label">${escapeHtml(name ?? 'This display')} has no screen assigned</p>
    <p class="sys-hint">Assign a screen or playlist in the dashboard</p>
  </main>
  <div class="sys-id">${escapeHtml(deviceId)}</div>
</div>`;
}
