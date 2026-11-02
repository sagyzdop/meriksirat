import { and, eq, inArray } from 'drizzle-orm'
import type { db } from '@/db'
import { photo, user } from '@/db/schema'
import { batchDeleteDriveFileResults } from '@/lib/google/google-drive'
import { withFlamekeeperToken } from '@/lib/flamekeeper/tokens'
import { releaseOwnedBytesStatements } from '@/lib/pool/server'
import {
  recreateAbandonedText,
  classifyDeleteError,
  classifyDeleteResult,
  planRecreateDeletes,
  type RecreateGroup,
  type RecreateRow,
  type RecreateTally,
} from './recreate'
import { chunk } from './photo-backfill'

type Database = ReturnType<typeof db>

const ROW_CHUNK = 90

async function dropRows(
  database: Database,
  rows: RecreateRow[]
): Promise<void> {
  for (const part of chunk(rows, ROW_CHUNK)) {
    const statements = [
      database.delete(photo).where(
        inArray(
          photo.id,
          part.map((r) => r.id)
        )
      ),
      ...releaseOwnedBytesStatements(database, part),
    ]
    await database.batch(statements as unknown as [(typeof statements)[0]])
  }
}

async function deleteGroup(
  database: Database,
  group: RecreateGroup,
  masterToken: string
): Promise<{ gone: RecreateRow[]; gaveUp: RecreateRow[] }> {
  const ids = group.rows.map((r) => r.driveFileId)
  let results: Awaited<ReturnType<typeof batchDeleteDriveFileResults>>
  try {
    results =
      group.owner === null
        ? await batchDeleteDriveFileResults(masterToken, ids)
        : await withFlamekeeperToken(database, group.owner, (token) =>
            batchDeleteDriveFileResults(token, ids)
          )
  } catch (error) {
    if (group.owner !== null && classifyDeleteError(error) === 'give_up') {
      console.error(
        `Could not delete ${group.rows.length} files of ${group.owner}:`,
        error
      )
      return { gone: [], gaveUp: group.rows }
    }
    console.warn(
      `Deferring ${group.rows.length} file deletions of ${group.owner ?? 'the club account'}:`,
      error
    )
    return { gone: [], gaveUp: [] }
  }
  const gone: RecreateRow[] = []
  const gaveUp: RecreateRow[] = []
  for (const r of group.rows) {
    const verdict = classifyDeleteResult(results.get(r.driveFileId))
    if (verdict === 'gone') gone.push(r)
    else if (verdict === 'give_up') gaveUp.push(r)
  }
  if (gaveUp.length > 0) {
    console.error(
      `Drive refused to delete ${gaveUp.length} files of ${group.owner ?? 'the club account'}`
    )
  }
  return { gone, gaveUp }
}

async function alertAbandoned(
  database: Database,
  owner: string | null,
  albumTitle: string,
  files: number
): Promise<void> {
  try {
    const { env } = await import('cloudflare:workers')
    const { sendAdminsTelegramResult } = await import('@/lib/pool/server')
    let who = 'the club account'
    if (owner) {
      const row = await database
        .select({ name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, owner))
        .get()
      who = row ? `${row.name} (${row.email})` : owner
    }
    await sendAdminsTelegramResult(
      database,
      (env as { TELEGRAM_BOT_TOKEN?: string }).TELEGRAM_BOT_TOKEN,
      recreateAbandonedText(who, albumTitle, files)
    )
  } catch (error) {
    console.error('Could not alert admins about abandoned files:', error)
  }
}

export function loadLivePhotoRefs(
  database: Database,
  albumId: string
): Promise<RecreateRow[]> {
  return database
    .select({
      id: photo.id,
      driveFileId: photo.driveFileId,
      bytes: photo.bytes,
      flamekeeperUserId: photo.flamekeeperUserId,
    })
    .from(photo)
    .where(and(eq(photo.albumId, albumId), eq(photo.state, 'live')))
    .all()
}

export async function runRecreateDeletePass(
  database: Database,
  album: { id: string; title: string },
  masterToken: string
): Promise<RecreateTally & { remaining: number }> {
  const rows = await loadLivePhotoRefs(database, album.id)

  const tally = { removed: 0, abandoned: 0 }
  let handled = 0
  for (const group of planRecreateDeletes(rows)) {
    const { gone, gaveUp } = await deleteGroup(database, group, masterToken)
    await dropRows(database, [...gone, ...gaveUp])
    tally.removed += gone.length
    tally.abandoned += gaveUp.length
    handled += gone.length + gaveUp.length
    if (gaveUp.length > 0) {
      await alertAbandoned(database, group.owner, album.title, gaveUp.length)
    }
  }
  return { ...tally, remaining: rows.length - handled }
}
