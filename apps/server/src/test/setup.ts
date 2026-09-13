import path from "node:path";
import { afterAll } from "vitest";
import { closeDb } from "@/lib/db/client";

process.env.ADMIN_PASSWORD = "test-admin-password";
process.env.DEVICE_SHARED_SECRET = "test-device-secret";
process.env.DATABASE_PATH = ":memory:";
process.env.MIGRATIONS_DIR = path.resolve(__dirname, "../../drizzle");
process.env.KIOSK_TIMEZONE = "America/Los_Angeles";

afterAll(() => closeDb());
