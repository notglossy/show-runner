import { getDb } from "@/lib/db/client";
import { env } from "@/lib/env";
import { startScheduler } from "@/lib/playlists/scheduler";
import { seedBuiltinScreens } from "@/lib/seed/seed";

const globalForStartup = globalThis as unknown as { __showrunnerStarted?: boolean };

/** Runs once per server process: validate config, migrate, seed, resume playlist rotation. */
export function startServer() {
  if (globalForStartup.__showrunnerStarted) return;
  globalForStartup.__showrunnerStarted = true;
  const config = env();
  getDb();
  const seeded = seedBuiltinScreens();
  startScheduler();
  console.log(
    `[showrunner] ready: db=${config.DATABASE_PATH} tz=${config.KIOSK_TIMEZONE} weather=${config.WEATHER_LAT},${config.WEATHER_LON} (${config.WEATHER_UNITS})` +
      (seeded.length ? ` seeded=${seeded.join(",")}` : ""),
  );
}
