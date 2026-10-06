import { describe, it, expect } from 'vitest'
import { drizzle } from 'drizzle-orm/sqlite-proxy'
import { eq, inArray, or } from 'drizzle-orm'
import { album, albumMember } from '../db/schema'

const db = drizzle(() => Promise.resolve({ rows: [] }))

describe('inArray with a subquery', () => {
  it('renders as `in (select ...)` with only the subquery params bound', () => {
    const memberAlbums = db
      .select({ albumId: albumMember.albumId })
      .from(albumMember)
      .where(eq(albumMember.userId, 'user-1'))

    const query = db
      .select({ id: album.id })
      .from(album)
      .where(
        or(eq(album.ownerUserId, 'user-1'), inArray(album.id, memberAlbums))
      )

    const { sql, params } = query.toSQL()
    expect(sql.toLowerCase()).toContain('in (select')
    expect(params).toEqual(['user-1', 'user-1'])
  })
})
