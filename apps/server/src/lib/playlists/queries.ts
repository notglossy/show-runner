import { asc, eq } from 'drizzle-orm';
import { getDb, type DbOrTx } from '@/lib/db/client';
import { playlistItems, screens } from '@/lib/db/schema';

export interface PlaylistItemView {
  id: string;
  screenId: string;
  screenName: string;
  position: number;
  dwellSeconds: number;
}

/** Lists a playlist's items in play order, joined with their screen names. */
export function playlistItemsFor(playlistId: string, db: DbOrTx = getDb()): PlaylistItemView[] {
  return db
    .select({
      id: playlistItems.id,
      screenId: playlistItems.screenId,
      screenName: screens.name,
      position: playlistItems.position,
      dwellSeconds: playlistItems.dwellSeconds,
    })
    .from(playlistItems)
    .innerJoin(screens, eq(screens.id, playlistItems.screenId))
    .where(eq(playlistItems.playlistId, playlistId))
    .orderBy(asc(playlistItems.position))
    .all();
}
