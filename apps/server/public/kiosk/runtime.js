// ShowKiosk runtime — injected into every rendered screen. Contract: docs/screen-authoring.md.
// Plain ES2022 for Chromium/Android WebView 139. No dependencies.
(() => {
  "use strict";

  /**
   * @typedef {{ type: string, screenId?: string | null, serverTime?: number }} KioskMessage
   * @typedef {{
   *   deviceId: string, screenId: string | null, viewer: "device" | "admin",
   *   refreshSeconds: number, serverTime: number,
   *   urls: { page: string, data: string, events: string, log: string },
   *   data: any
   * }} Boot
   */

  /** @type {Boot} */
  const boot = /** @type {any} */ (window).__KIOSK_BOOT__;
  if (!boot) {
    console.error("[kiosk] missing boot config");
    return;
  }

  const MISSING = "—";
  const listeners = new Map();
  let data = boot.data || {};
  let clockOffsetMs = boot.serverTime - Date.now();
  let domReady = document.readyState !== "loading";
  let connected = false;

  // ---- events --------------------------------------------------------------

  function emit(event, payload) {
    const set = listeners.get(event);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        reportError(err, `kiosk.on("${event}") handler`);
      }
    }
  }

  function on(event, fn) {
    if (typeof fn !== "function") throw new TypeError("kiosk.on(event, fn): fn must be a function");
    if (!listeners.has(event)) listeners.set(event, new Set());
    listeners.get(event).add(fn);
    // Late subscribers get the current value right away (after the DOM is parsed).
    if (domReady && (event === "data" || event === "tick")) {
      queueMicrotask(() => {
        if (!listeners.get(event)?.has(fn)) return;
        try {
          fn(event === "data" ? data : data.time);
        } catch (err) {
          reportError(err, `kiosk.on("${event}") handler`);
        }
      });
    }
    return () => off(event, fn);
  }

  function off(event, fn) {
    listeners.get(event)?.delete(fn);
  }

  // ---- paths + bindings ------------------------------------------------------

  function get(path, fallback) {
    let value = data;
    for (const key of String(path).split(".")) {
      if (value === null || value === undefined) return fallback;
      value = value[key];
    }
    return value === undefined || value === null ? fallback : value;
  }

  function toText(value, el) {
    if (value === undefined || value === null || typeof value === "object" || value === "") {
      return el.getAttribute("data-fallback") ?? MISSING;
    }
    return String(value);
  }

  function applyBindings(root = document) {
    for (const el of root.querySelectorAll("[data-bind]")) {
      const value = get(el.getAttribute("data-bind"));
      const text = toText(value, el);
      if (el.textContent !== text) el.textContent = text;
      el.toggleAttribute("data-bind-missing", value === undefined || value === null || typeof value === "object");
    }
    for (const el of root.querySelectorAll("[data-bind-attr]")) {
      for (const pair of el.getAttribute("data-bind-attr").split(";")) {
        const idx = pair.indexOf(":");
        if (idx < 1) continue;
        const attr = pair.slice(0, idx).trim();
        const value = get(pair.slice(idx + 1).trim());
        if (value === undefined || value === null || typeof value === "object") {
          el.removeAttribute(attr);
        } else if (el.getAttribute(attr) !== String(value)) {
          el.setAttribute(attr, String(value));
        }
      }
    }
  }

  // ---- time ----------------------------------------------------------------

  const formatterCache = new Map();
  function formatter(timeZone, options) {
    const key = timeZone + JSON.stringify(options);
    let f = formatterCache.get(key);
    if (!f) formatterCache.set(key, (f = new Intl.DateTimeFormat("en-US", { timeZone, ...options })));
    return f;
  }

  function deriveTime() {
    const base = data.time || {};
    const timeZone = base.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
    const epochMs = Date.now() + clockOffsetMs;
    const date = new Date(epochMs);
    const parts = {};
    for (const p of formatter(timeZone, {
      hourCycle: "h23",
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(date)) {
      parts[p.type] = p.value;
    }
    const h24 = Number(parts.hour) % 24;
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const hour24 = String(h24).padStart(2, "0");
    const monthShort = formatter(timeZone, { month: "short" }).format(date);
    const weekdayShort = formatter(timeZone, { weekday: "short" }).format(date);
    const monthNum = formatter(timeZone, { month: "2-digit" }).format(date);
    const dayPadded = String(parts.day).padStart(2, "0");
    data.time = {
      ...base,
      epochMs,
      iso: date.toISOString(),
      timezone: timeZone,
      hour24,
      hour12: String(h12),
      minute: parts.minute,
      second: parts.second,
      ampm: h24 < 12 ? "AM" : "PM",
      hhmm: `${h12}:${parts.minute}`,
      hhmm24: `${hour24}:${parts.minute}`,
      weekday: parts.weekday,
      weekdayShort,
      month: parts.month,
      monthShort,
      day: parts.day,
      year: parts.year,
      date: `${parts.weekday}, ${parts.month} ${parts.day}`,
      dateShort: `${weekdayShort}, ${monthShort} ${parts.day}`,
      isoDate: `${parts.year}-${monthNum}-${dayPadded}`,
      greeting: h24 < 5 ? "Good night" : h24 < 12 ? "Good morning" : h24 < 17 ? "Good afternoon" : h24 < 21 ? "Good evening" : "Good night",
    };
  }

  function tick() {
    deriveTime();
    applyBindings();
    emit("tick", data.time);
  }

  function scheduleTick() {
    // Align to the next wall-clock second so seconds flip on time.
    const now = Date.now() + clockOffsetMs;
    setTimeout(() => {
      tick();
      scheduleTick();
    }, 1000 - (now % 1000) + 5);
  }

  // ---- data polling ----------------------------------------------------------

  let refreshTimer = 0;
  let failures = 0;

  async function refresh() {
    clearTimeout(refreshTimer);
    const started = Date.now();
    try {
      const res = await fetch(boot.urls.data, { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error(`data HTTP ${res.status}`);
      const next = await res.json();
      const finished = Date.now();
      if (next?.time?.epochMs) clockOffsetMs = next.time.epochMs - (started + finished) / 2;
      data = next;
      failures = 0;
      deriveTime();
      applyBindings();
      emit("data", data);
    } catch (err) {
      failures++;
      console.warn("[kiosk] data refresh failed", err);
      if (failures === 3) reportError(err, "data refresh (3 consecutive failures)", "warn");
    } finally {
      const base = Math.max(5, boot.refreshSeconds) * 1000;
      const delay = failures ? Math.min(base * 2 ** Math.min(failures, 4), 5 * 60_000) : base;
      refreshTimer = setTimeout(refresh, delay);
    }
  }

  // ---- server commands (SSE) -----------------------------------------------

  let source = null;
  let reconnectDelay = 1000;

  function goToCurrentScreen() {
    location.replace(boot.urls.page);
  }

  function handleMessage(/** @type {KioskMessage} */ msg) {
    if (msg.type !== "hello") emit("command", msg);
    switch (msg.type) {
      case "hello":
        // The server's idea of the current screen changed while we were disconnected.
        if ((msg.screenId ?? null) !== (boot.screenId ?? null)) goToCurrentScreen();
        break;
      case "reload":
        location.reload();
        break;
      case "navigate":
        goToCurrentScreen();
        break;
      case "refreshData":
        refresh();
        break;
      default:
        break;
    }
  }

  function setConnected(value) {
    if (connected === value) return;
    connected = value;
    emit("connection", { connected: value });
  }

  function connect() {
    if (!("EventSource" in window)) return;
    source = new EventSource(boot.urls.events, { withCredentials: true });
    source.onopen = () => {
      reconnectDelay = 1000;
      setConnected(true);
    };
    source.onmessage = (event) => {
      try {
        handleMessage(JSON.parse(event.data));
      } catch (err) {
        reportError(err, "SSE message");
      }
    };
    source.onerror = () => {
      setConnected(false);
      // EventSource retries by itself unless the server refused the connection outright.
      if (source.readyState === EventSource.CLOSED) {
        source.close();
        setTimeout(connect, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, 60_000);
      }
    };
  }

  // ---- error reporting ------------------------------------------------------

  const recentReports = new Map();
  let reportCount = 0;

  function send(level, message, extra = {}) {
    const key = `${level}:${message}`;
    const now = Date.now();
    if (recentReports.has(key) && now - recentReports.get(key) < 60_000) return;
    recentReports.set(key, now);
    if (boot.viewer !== "device") {
      console[level === "info" ? "log" : level]("[kiosk:log]", message, extra);
      return;
    }
    if (++reportCount > 50) return;
    const body = JSON.stringify({
      level,
      message: String(message).slice(0, 4000),
      source: extra.source ?? null,
      line: Number.isInteger(extra.line) ? extra.line : null,
      column: Number.isInteger(extra.column) ? extra.column : null,
      stack: extra.stack ? String(extra.stack).slice(0, 16000) : null,
      url: location.href.slice(0, 2048),
      screenId: boot.screenId,
    });
    fetch(boot.urls.log, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      keepalive: true,
      body,
    }).catch(() => {});
  }

  function reportError(err, context, level = "error") {
    const message = err instanceof Error ? err.message : String(err);
    send(level, context ? `${context}: ${message}` : message, { stack: err instanceof Error ? err.stack : null });
  }

  window.addEventListener("error", (event) => {
    send("error", event.message || "Script error", {
      source: event.filename,
      line: event.lineno,
      column: event.colno,
      stack: event.error?.stack,
    });
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    send("error", `Unhandled rejection: ${reason instanceof Error ? reason.message : String(reason)}`, {
      stack: reason instanceof Error ? reason.stack : null,
    });
  });

  // ---- public API ------------------------------------------------------------

  const kiosk = Object.freeze({
    version: 1,
    get data() {
      return data;
    },
    deviceId: boot.deviceId,
    screenId: boot.screenId,
    viewer: boot.viewer,
    get connected() {
      return connected;
    },
    on,
    off,
    get,
    refresh,
    applyBindings,
    log(level, message) {
      send(level === "warn" || level === "info" ? level : "error", message);
    },
    get native() {
      return /** @type {any} */ (window).KioskNative ?? null;
    },
  });
  Object.defineProperty(window, "kiosk", { value: kiosk, writable: false, configurable: false });

  // ---- start -----------------------------------------------------------------

  deriveTime();

  function start() {
    domReady = true;
    applyBindings();
    emit("data", data);
    emit("tick", data.time);
    scheduleTick();
    refreshTimer = setTimeout(refresh, Math.max(5, boot.refreshSeconds) * 1000);
    connect();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  } else {
    start();
  }
})();
