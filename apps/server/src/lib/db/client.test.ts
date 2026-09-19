import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';
import { getDb } from './client';
import { devices, playlistItems, playlists, screens } from './schema';

describe('database', () => {
  it('migrates and enforces foreign keys', () => {
    const db = getDb();
    db.insert(screens).values({ id: 's1', name: 'S1', html: '<p>hi</p>' }).run();
    db.insert(playlists).values({ id: 'p1', name: 'P1' }).run();
    db.insert(playlistItems)
      .values({ id: 'i1', playlistId: 'p1', screenId: 's1', position: 0, dwellSeconds: 30 })
      .run();

    // screen referenced by a playlist item cannot be deleted
    expect(() => db.delete(screens).where(eq(screens.id, 's1')).run()).toThrow(/FOREIGN KEY/);

    // deleting the playlist cascades to its items
    db.delete(playlists).where(eq(playlists.id, 'p1')).run();
    expect(db.select().from(playlistItems).all()).toHaveLength(0);
  });

  it('stores timestamps as integer milliseconds and JSON status', () => {
    const db = getDb();
    const row = db
      .insert(devices)
      .values({
        id: 'd1',
        tokenHash: 'x',
        model: 'm',
        androidVersion: '11',
        appVersion: '0.1.0',
        screenWidth: 1280,
        screenHeight: 800,
        registeredAt: new Date(),
        status: { battery: { level: 50, charging: true } },
      })
      .returning()
      .get();
    expect(row.createdAt).toBeInstanceOf(Date);
    expect(row.status.battery?.level).toBe(50);
    expect(row.assignmentType).toBe('none');
  });
});
