import { describe, expect, it } from "vitest";
import { samplePayload } from "@/lib/providers/sample";
import { deviceUrls, escapeHtml, jsonForScript, renderKioskDocument, renderPlainPage } from "./document";
import { pairingScreen, unassignedScreen } from "./system-screens";

const boot = (overrides = {}) => ({
  deviceId: "dev-1",
  screenId: "s1",
  viewer: "device" as const,
  refreshSeconds: 60,
  serverTime: 1,
  urls: deviceUrls("dev-1"),
  data: samplePayload(),
  ...overrides,
});

describe("renderKioskDocument", () => {
  it("wraps the fragment with base CSS, boot config, and the runtime before the body", () => {
    const html = renderKioskDocument({ title: "Clock", body: "<p data-bind=\"time.hhmm\"></p>", boot: boot() });
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain('<meta name="viewport" content="width=1280');
    expect(html).toContain('data-viewer="device"');
    expect(html.indexOf("__KIOSK_BOOT__")).toBeLessThan(html.indexOf("/kiosk/runtime.js"));
    expect(html.indexOf("/kiosk/runtime.js")).toBeLessThan(html.indexOf("<body"));
    expect(html).toContain('<p data-bind="time.hhmm"></p>');
    expect(html).toContain("<title>Clock · ShowRunner</title>");
  });

  it("embeds boot JSON that cannot break out of the script tag", () => {
    const data = { ...samplePayload(), screen: { id: "x", name: "</script><script>alert(1)</script>" } };
    const html = renderKioskDocument({ title: "<b>", body: "", boot: boot({ data }) });
    const script = html.slice(html.indexOf("window.__KIOSK_BOOT__="), html.indexOf(";</script>"));
    expect(script).not.toContain("</script>");
    expect(html).toContain("<title>&lt;b&gt; · ShowRunner</title>");
    const parsed = JSON.parse(script.replace("window.__KIOSK_BOOT__=", ""));
    expect(parsed.data.screen.name).toBe("</script><script>alert(1)</script>");
  });

  it("escapes line separators for inline scripts", () => {
    const input = "a" + String.fromCharCode(0x2028) + "b" + String.fromCharCode(0x2029) + "c";
    const out = jsonForScript(input);
    expect(out).toBe('"a' + "\\" + 'u2028b' + "\\" + 'u2029c"');
    expect(JSON.parse(out)).toBe(input);
  });
});

describe("system screens + helpers", () => {
  it("escapes device-controlled values", () => {
    expect(pairingScreen("AB<3", "id\"x")).toContain("AB&lt;3");
    expect(unassignedScreen("<Kitchen>", "d")).toContain("&lt;Kitchen&gt;");
    expect(renderPlainPage("Hi & bye", "<x>")).toContain("Hi &amp; bye");
    expect(escapeHtml(`'"&<>`)).toBe("&#39;&quot;&amp;&lt;&gt;");
  });

  it("builds URL-encoded device URLs", () => {
    expect(deviceUrls("a b").page).toBe("/device/a%20b");
    expect(deviceUrls("x").events).toBe("/api/devices/x/events");
  });
});
