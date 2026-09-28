import { getDb } from '@/lib/db/client';
import { env } from '@/lib/env';
import { startScheduler } from '@/lib/playlists/scheduler';
import { seedBuiltinScreens } from '@/lib/seed/seed';

const globalForStartup = globalThis as unknown as { __showrunnerStarted?: boolean };

/** Runs once per server process: validate config, migrate, seed, resume playlist rotation. */
export function startServer() {
  if (globalForStartup.__showrunnerStarted) return;
  globalForStartup.__showrunnerStarted = true;
  const config = env();
  if (!config.DEVICE_SHARED_SECRET) {
    console.warn(
      '[showrunner] DEVICE_SHARED_SECRET is not set: displays register only while "Add a display" is open. ' +
        'Displays running app 0.2 or older cannot re-register after a reboot on this server (see docs/device-setup.md).',
    );
  }
  getDb();
  const seeded = seedBuiltinScreens();
  startScheduler();
  console.log(
    `[showrunner] ready: db=${config.DATABASE_PATH} tz=${config.KIOSK_TIMEZONE} weather=${config.WEATHER_LAT},${config.WEATHER_LON} (${config.WEATHER_UNITS})` +
      (seeded.length ? ` seeded=${seeded.join(',')}` : ''),
  );
}
