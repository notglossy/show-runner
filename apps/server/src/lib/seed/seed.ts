import { count } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { screens } from "@/lib/db/schema";
import { createScreen } from "@/lib/screens/service";
import { BUILTIN_SCREENS } from "./screens";

/**
 * Inserts the built-in screens when the screens table is empty (first boot).
 * Afterwards they're ordinary rows the owner can edit or delete.
 */
export function seedBuiltinScreens(): string[] {
  const db = getDb();
  const existing = db.select({ n: count() }).from(screens).get()?.n ?? 0;
  if (existing > 0) return [];
  for (const screen of BUILTIN_SCREENS) createScreen({ ...screen, source: "builtin" });
  return BUILTIN_SCREENS.map((s) => s.id);
}
