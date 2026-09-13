/** Commands the server pushes to a device's kiosk runtime over SSE. */
export type KioskCommand =
  | { type: "reload" }
  | { type: "navigate"; screenId: string | null }
  | { type: "refreshData" };

export type KioskEvent = KioskCommand | { type: "hello"; screenId: string | null; serverTime: number };

export type ViewerKind = "device" | "admin";

interface Subscriber {
  viewer: ViewerKind;
  send: (event: KioskEvent) => void;
}

const globalForBus = globalThis as unknown as { __showkioskBus?: Map<string, Set<Subscriber>> };
const channels = (globalForBus.__showkioskBus ??= new Map());

export function subscribe(deviceId: string, viewer: ViewerKind, send: Subscriber["send"]): () => void {
  const sub: Subscriber = { viewer, send };
  let set = channels.get(deviceId);
  if (!set) channels.set(deviceId, (set = new Set()));
  set.add(sub);
  return () => {
    set.delete(sub);
    if (set.size === 0) channels.delete(deviceId);
  };
}

/** Sends a command to every open connection for the device. Returns how many received it. */
export function publish(deviceId: string, command: KioskCommand): number {
  const set = channels.get(deviceId);
  if (!set) return 0;
  for (const sub of set) {
    try {
      sub.send(command);
    } catch (err) {
      console.error(`[bus] send to ${deviceId} failed`, err);
    }
  }
  return set.size;
}

export function connectionCount(deviceId: string, viewer?: ViewerKind): number {
  const set = channels.get(deviceId);
  if (!set) return 0;
  if (!viewer) return set.size;
  let n = 0;
  for (const sub of set) if (sub.viewer === viewer) n++;
  return n;
}
