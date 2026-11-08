import { eq, sql } from 'drizzle-orm'
import type { Database } from '@/db'
import { volume } from '@/db/schema'

export async function nextVolumeNumber(
  database: Database,
  albumId: string
): Promise<number> {
  const row = await database
    .select({ top: sql<number>`COALESCE(MAX(${volume.number}), 0)` })
    .from(volume)
    .where(eq(volume.albumId, albumId))
    .get()
  return (row?.top ?? 0) + 1
}
