import { describe, expect, it } from 'vitest'
import {
  LISTING_DRIVE_BUDGET,
  LISTING_FRESH_MS,
  LISTING_RETRY_MS,
  LISTING_SETTLE_MS,
  LISTING_STAMP_THROTTLE_MS,
  LISTING_STALE_LIMIT_MS,
  applyListingOutcomes,
  classifyListingError,
  findListedFile,
  findListedFileOwner,
  listingTotals,
  listingPhotos,
  newerListingEntry,
  parseListingEntry,
  planListingRefresh,
  planListingSources,
  readAlbumListing,
} from '@/lib/albums/listing'
import type {
  AlbumListingEntry,
  ListingFile,
  ListingOutcome,
} from '@/lib/albums/listing'
import { DriveNotFoundError } from '@/lib/google/google-drive'

const NOW = 1_800_000_000_000
const ROOT = 'album-folder'

function file(id: string, extra: Partial<ListingFile> = {}): ListingFile {
  return {
    id,
    name: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: '100',
    createdTime: '2026-01-01T00:00:00.000Z',
    ...extra,
  }
}

function sourcesOf(
  input: Partial<Parameters<typeof planListingSources>[0]> = {}
) {
  return planListingSources({
    albumFolderId: ROOT,
    bufferVolume: {
      driveFolderId: 'buffer-folder',
      expectedCount: 2,
      expectedBytes: 200,
    },
    flamekeeperVolumes: [],
    ...input,
  })
}

function keeper(
  userId: string,
  extra: Partial<
    Parameters<typeof planListingSources>[0]['flamekeeperVolumes'][0]
  > = {}
) {
  return {
    userId,
    driveFolderId: `${userId}-folder`,
    droppedAt: null,
    state: 'active' as const,
    hasGrant: true,
    ...extra,
  }
}

function freshEntry(
  sources: ReturnType<typeof sourcesOf>,
  files: Record<string, ListingFile[]> = {},
  at = NOW
): AlbumListingEntry {
  const outcomes: Record<string, ListingOutcome> = {}
  for (const s of sources) {
    outcomes[s.key] = {
      kind: 'listed',
      files: files[s.key] ?? [],
      complete: true,
    }
  }
  return applyListingOutcomes({
    sources,
    entry: null,
    now: at,
    folderState: 'ok',
    outcomes,
  })
}

describe('what to list, and with whose token', () => {
  it('lists the album folder with the master token and the buffer volume with the buffer token', () => {
    const sources = sourcesOf()
    expect(sources.map((s) => [s.owner.kind, s.folderId])).toEqual([
      ['buffer', 'buffer-folder'],
      ['master', ROOT],
    ])
  })

  it('lists each flamekeeper volume with that flamekeeper’s own token', () => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const volume = sources.find((s) => s.owner.kind === 'flamekeeper')
    expect(volume?.owner).toEqual({ kind: 'flamekeeper', userId: 'amina' })
    expect(volume?.folderId).toBe('amina-folder')
  })

  it('expects nothing from a buffer volume that carries no expected values', () => {
    const sources = sourcesOf({
      bufferVolume: {
        driveFolderId: 'buffer-folder',
        expectedCount: null,
        expectedBytes: null,
      },
    })
    const buffer = sources.find((s) => s.key === 'buffer')
    expect(buffer?.expected).toBeNull()
  })

  it('has nothing to list for a volume with no folder yet', () => {
    const sources = sourcesOf({
      bufferVolume: {
        driveFolderId: null,
        expectedCount: 0,
        expectedBytes: 0,
      },
      flamekeeperVolumes: [keeper('amina', { driveFolderId: null })],
    })
    expect(sources.map((s) => s.owner.kind)).toEqual(['master'])
  })

  it('leaves out a lost flamekeeper’s volume once its photos have dropped out', () => {
    const sources = sourcesOf({
      flamekeeperVolumes: [
        keeper('amina', { state: 'lost', droppedAt: new Date(NOW) }),
      ],
    })
    expect(sources.some((s) => s.owner.kind === 'flamekeeper')).toBe(false)
  })

  it('makes no Drive call for a flamekeeper who is lost or has no grant', () => {
    const sources = sourcesOf({
      flamekeeperVolumes: [
        keeper('lost', { state: 'lost' }),
        keeper('gone', { hasGrant: false }),
      ],
    })
    const plan = planListingRefresh({ sources, entry: null, now: NOW })
    expect(plan.actions['flamekeeper:lost']).toBe('keep')
    expect(plan.actions['flamekeeper:gone']).toBe('keep')
  })

  it('still lists a draining flamekeeper, so photos stay available during a drain', () => {
    const sources = sourcesOf({
      flamekeeperVolumes: [keeper('amina', { state: 'draining' })],
    })
    const plan = planListingRefresh({ sources, entry: null, now: NOW })
    expect(plan.actions['flamekeeper:amina']).toBe('list')
  })
})

describe('when a cached listing can be used', () => {
  it('makes no Drive call while every listing is fresh', () => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const plan = planListingRefresh({
      sources,
      entry: freshEntry(sources, {}, NOW - LISTING_FRESH_MS + 1000),
      now: NOW,
    })
    expect(plan.checkFolder).toBe(false)
    expect(Object.values(plan.actions).every((a) => a === 'reuse')).toBe(true)
  })

  it('lists everything on a cold load, and checks the folder first', () => {
    const plan = planListingRefresh({
      sources: sourcesOf(),
      entry: null,
      now: NOW,
    })
    expect(plan.checkFolder).toBe(true)
    expect(Object.values(plan.actions)).toEqual(['list', 'list'])
  })

  it('lists again once a listing has aged out', () => {
    const sources = sourcesOf()
    const plan = planListingRefresh({
      sources,
      entry: freshEntry(sources, {}, NOW - LISTING_FRESH_MS),
      now: NOW,
    })
    expect(Object.values(plan.actions)).toEqual(['list', 'list'])
  })

  it('re-lists only the buffer after an upload or deletion changes its expected values', () => {
    const entry = freshEntry(sourcesOf())
    const afterUpload = sourcesOf({
      bufferVolume: {
        driveFolderId: 'buffer-folder',
        expectedCount: 3,
        expectedBytes: 300,
      },
    })
    const plan = planListingRefresh({
      sources: afterUpload,
      entry,
      now: NOW + 1000,
    })
    expect(plan.actions.buffer).toBe('list')
    expect(plan.actions.master).toBe('reuse')
    expect(plan.checkFolder).toBe(true)
  })

  it('lists a volume the cache has not seen yet', () => {
    const entry = freshEntry(sourcesOf())
    const plan = planListingRefresh({
      sources: sourcesOf({ flamekeeperVolumes: [keeper('amina')] }),
      entry,
      now: NOW + 1000,
    })
    expect(plan.actions['flamekeeper:amina']).toBe('list')
    expect(plan.actions.buffer).toBe('reuse')
  })

  it('lists everything when an owner presses Refresh', () => {
    const sources = sourcesOf()
    const plan = planListingRefresh({
      sources,
      entry: freshEntry(sources),
      now: NOW + 1000,
      force: true,
    })
    expect(Object.values(plan.actions)).toEqual(['list', 'list'])
  })

  it('lists at once when a flamekeeper reconnects, so their photos return', () => {
    const lost = sourcesOf({
      flamekeeperVolumes: [keeper('amina', { state: 'lost' })],
    })
    const entry = applyListingOutcomes({
      sources: lost,
      entry: null,
      now: NOW,
      folderState: 'ok',
      outcomes: {},
    })
    const back = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const plan = planListingRefresh({ sources: back, entry, now: NOW + 1000 })
    expect(plan.actions['flamekeeper:amina']).toBe('list')
  })
})

describe('merging volume listings into one album', () => {
  it('shows photos from every volume, sorted by capture time', () => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const entry = freshEntry(sources, {
      buffer: [file('b', { createdTime: '2026-03-01T00:00:00.000Z' })],
      master: [file('m', { createdTime: '2026-01-01T00:00:00.000Z' })],
      'flamekeeper:amina': [
        file('f', { createdTime: '2026-02-01T00:00:00.000Z' }),
      ],
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listingPhotos(listing).map((p) => p.id)).toEqual(['m', 'f', 'b'])
    expect(listing.complete).toBe(true)
  })

  it('leaves out anything that is not an image', () => {
    const sources = sourcesOf()
    const entry = freshEntry(sources, {
      master: [file('a'), file('doc', { mimeType: 'application/pdf' })],
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listing.files.map((f) => f.id)).toEqual(['a'])
  })

  it('shows one photo when a move leaves the same file in two volumes, preferring the buffer', () => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const entry = freshEntry(sources, {
      buffer: [file('copy', { md5Checksum: 'abc' })],
      'flamekeeper:amina': [file('original', { md5Checksum: 'abc' })],
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listing.files.map((f) => f.id)).toEqual(['copy'])
  })

  it('keeps identical photos that really are two files in one volume', () => {
    const sources = sourcesOf()
    const entry = freshEntry(sources, {
      master: [
        file('one', { md5Checksum: 'abc' }),
        file('two', { md5Checksum: 'abc' }),
      ],
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listing.files.map((f) => f.id)).toEqual(['one', 'two'])
  })

  it('never sends the owner or checksum to the browser', () => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const entry = freshEntry(sources, {
      'flamekeeper:amina': [file('f', { md5Checksum: 'abc' })],
    })
    const json = JSON.stringify(
      listingPhotos(readAlbumListing({ entry, sources, now: NOW }))
    )
    expect(json).not.toContain('amina')
    expect(json).not.toContain('abc')
  })

  it('reports each volume’s count and bytes against its expected values', () => {
    const sources = sourcesOf()
    const entry = freshEntry(sources, { buffer: [file('a')] })
    const buffer = readAlbumListing({ entry, sources, now: NOW }).volumes.find(
      (v) => v.key === 'buffer'
    )
    expect(buffer).toMatchObject({
      status: 'ok',
      count: 1,
      bytes: 100,
      expected: { count: 2, bytes: 200 },
    })
  })

  it('loads an album over the old 2,000-photo limit, split across volumes', () => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const many = (prefix: string, n: number) =>
      Array.from({ length: n }, (_, i) => file(`${prefix}${i}`))
    const entry = freshEntry(sources, {
      buffer: many('b', 2600),
      'flamekeeper:amina': many('f', 900),
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listingPhotos(listing)).toHaveLength(3500)
    expect(listing.complete).toBe(true)
  })
})

describe('when a listing fails', () => {
  const sources = sourcesOf()
  const before = freshEntry(
    sources,
    { buffer: [file('a')], master: [file('m')] },
    NOW - LISTING_FRESH_MS
  )

  function failBuffer(entry: AlbumListingEntry | null, at = NOW) {
    return applyListingOutcomes({
      sources,
      entry,
      now: at,
      folderState: 'ok',
      outcomes: {
        buffer: { kind: 'failed' },
        master: { kind: 'listed', files: [file('m')], complete: true },
      },
    })
  }

  it('treats any Drive or token error as a failure, and a missing folder as gone', () => {
    expect(classifyListingError(new Error('Drive API error (500)'))).toBe(
      'failed'
    )
    expect(classifyListingError(new DriveNotFoundError())).toBe('gone')
  })

  it('keeps showing the last good photos and says the listing is incomplete', () => {
    const listing = readAlbumListing({
      entry: failBuffer(before),
      sources,
      now: NOW,
    })
    expect(listing.files.map((f) => f.id).sort()).toEqual(['a', 'm'])
    expect(listing.complete).toBe(false)
    expect(listing.volumes.find((v) => v.key === 'buffer')?.status).toBe(
      'failed'
    )
  })

  it('still renders the other volumes when there is no last good listing', () => {
    const listing = readAlbumListing({
      entry: failBuffer(null),
      sources,
      now: NOW,
    })
    expect(listing.files.map((f) => f.id)).toEqual(['m'])
    expect(listing.complete).toBe(false)
  })

  it('waits before trying a failed listing again', () => {
    const failed = failBuffer(before)
    const soon = planListingRefresh({
      sources,
      entry: failed,
      now: NOW + LISTING_RETRY_MS - 1,
    })
    expect(soon.actions.buffer).toBe('reuse')
    const later = planListingRefresh({
      sources,
      entry: failed,
      now: NOW + LISTING_RETRY_MS,
    })
    expect(later.actions.buffer).toBe('list')
    expect(later.actions.master).toBe('reuse')
  })

  it('stops showing last good photos after the 7-day limit', () => {
    const listing = readAlbumListing({
      entry: failBuffer(before),
      sources,
      now: NOW - LISTING_FRESH_MS + LISTING_STALE_LIMIT_MS + 1,
    })
    expect(listing.files.map((f) => f.id)).toEqual(['m'])
  })

  it('keeps a lost flamekeeper’s last good photos until they drop out', () => {
    const live = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const cached = freshEntry(live, {
      'flamekeeper:amina': [file('f')],
    })
    const lost = sourcesOf({
      flamekeeperVolumes: [keeper('amina', { state: 'lost' })],
    })
    const listing = readAlbumListing({
      entry: cached,
      sources: lost,
      now: NOW + 1000,
    })
    expect(listing.files.map((f) => f.id)).toEqual(['f'])
    expect(
      listing.volumes.find((v) => v.key === 'flamekeeper:amina')?.status
    ).toBe('unavailable')
    expect(listing.complete).toBe(false)
  })

  it('shows what it got when the request budget runs out, without calling it complete', () => {
    const entry = applyListingOutcomes({
      sources,
      entry: null,
      now: NOW,
      folderState: 'ok',
      outcomes: {
        buffer: { kind: 'listed', files: [file('a')], complete: false },
        master: { kind: 'listed', files: [], complete: true },
      },
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listing.files.map((f) => f.id)).toEqual(['a'])
    expect(listing.complete).toBe(false)
    expect(listing.volumes.find((v) => v.key === 'buffer')?.status).toBe(
      'partial'
    )
  })

  it('tries a skipped volume again on the next view, keeping what it had', () => {
    const entry = applyListingOutcomes({
      sources,
      entry: before,
      now: NOW,
      folderState: 'ok',
      outcomes: {
        buffer: { kind: 'skipped' },
        master: { kind: 'listed', files: [file('m')], complete: true },
      },
    })
    const plan = planListingRefresh({ sources, entry, now: NOW + 1 })
    expect(plan.actions.buffer).toBe('list')
    expect(
      readAlbumListing({ entry, sources, now: NOW }).files.map((f) => f.id)
    ).toContain('a')
  })

  it('reports a volume whose folder is gone as missing, not as a failure', () => {
    const entry = applyListingOutcomes({
      sources,
      entry: before,
      now: NOW,
      folderState: 'ok',
      outcomes: {
        buffer: { kind: 'gone' },
        master: { kind: 'listed', files: [], complete: true },
      },
    })
    const listing = readAlbumListing({ entry, sources, now: NOW })
    expect(listing.volumes.find((v) => v.key === 'buffer')?.status).toBe(
      'missing'
    )
    expect(listing.files).toEqual([])
  })

  it('stays within the Worker subrequest limit on a cold load', () => {
    expect(LISTING_DRIVE_BUDGET).toBeLessThanOrEqual(40)
  })
})

describe('album folder state', () => {
  const sources = sourcesOf()
  const before = freshEntry(sources, { buffer: [file('a')] })

  it('shows no photos and reports missing when the folder is permanently gone', () => {
    const entry = applyListingOutcomes({
      sources,
      entry: before,
      now: NOW + 1000,
      folderState: 'missing',
      outcomes: {},
    })
    const listing = readAlbumListing({ entry, sources, now: NOW + 1000 })
    expect(listing.folderState).toBe('missing')
    expect(listing.files).toEqual([])
  })

  it('keeps the last good photos while the folder is in the bin', () => {
    const entry = applyListingOutcomes({
      sources,
      entry: before,
      now: NOW + 1000,
      folderState: 'trashed',
      outcomes: {},
    })
    const listing = readAlbumListing({ entry, sources, now: NOW + 1000 })
    expect(listing.folderState).toBe('trashed')
    expect(listing.files.map((f) => f.id)).toEqual(['a'])
    expect(listing.complete).toBe(false)
  })

  it('assumes ok rather than warning when the state could not be checked', () => {
    const entry = applyListingOutcomes({
      sources,
      entry: null,
      now: NOW,
      folderState: null,
      outcomes: {},
    })
    expect(entry.folderState).toBe('ok')
  })

  it('keeps the known state when a later check fails', () => {
    const trashed = applyListingOutcomes({
      sources,
      entry: before,
      now: NOW,
      folderState: 'trashed',
      outcomes: {},
    })
    const entry = applyListingOutcomes({
      sources,
      entry: trashed,
      now: NOW + 1000,
      folderState: null,
      outcomes: {},
    })
    expect(entry.folderState).toBe('trashed')
  })
})

describe('reading a cached entry', () => {
  it('ignores the older cache shape and anything unreadable', () => {
    expect(parseListingEntry(null)).toBeNull()
    expect(parseListingEntry('not json')).toBeNull()
    expect(
      parseListingEntry(JSON.stringify({ files: [], folderState: 'ok' }))
    ).toBeNull()
  })

  it('round-trips an entry', () => {
    const entry = freshEntry(sourcesOf(), { buffer: [file('a')] })
    expect(parseListingEntry(JSON.stringify(entry))).toEqual(entry)
  })
})

describe('who owns a file in the album', () => {
  const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
  const listing = readAlbumListing({
    entry: freshEntry(sources, {
      buffer: [file('b1', { size: '300' })],
      master: [file('m1')],
      'flamekeeper:amina': [file('f1')],
    }),
    sources,
    now: NOW,
  })

  it('names the owner whose token can act on a listed file', () => {
    expect(findListedFileOwner(listing, 'b1')).toEqual({ kind: 'buffer' })
    expect(findListedFileOwner(listing, 'm1')).toEqual({ kind: 'master' })
    expect(findListedFileOwner(listing, 'f1')).toEqual({
      kind: 'flamekeeper',
      userId: 'amina',
    })
  })

  it('knows nothing about a file the album does not list', () => {
    expect(findListedFileOwner(listing, 'elsewhere')).toBeNull()
    expect(findListedFile(listing, 'elsewhere')).toBeNull()
  })

  it('returns the listed file with its owner, so its size can be settled', () => {
    expect(findListedFile(listing, 'b1')).toMatchObject({
      owner: { kind: 'buffer' },
      file: { id: 'b1', size: '300' },
    })
  })

  it('does not treat a non-image in a folder as a photo of the album', () => {
    const withPdf = readAlbumListing({
      entry: freshEntry(sources, {
        buffer: [file('doc', { mimeType: 'application/pdf' })],
      }),
      sources,
      now: NOW,
    })
    expect(findListedFile(withPdf, 'doc')).toBeNull()
  })
})

describe('album totals from a listing', () => {
  const read = (
    files: Record<string, ListingFile[]>,
    outcomes?: Record<string, ListingOutcome>
  ) => {
    const sources = sourcesOf({ flamekeeperVolumes: [keeper('amina')] })
    const entry = outcomes
      ? applyListingOutcomes({
          sources,
          entry: freshEntry(sources, files),
          now: NOW + 1,
          folderState: 'ok',
          outcomes,
        })
      : freshEntry(sources, files)
    return readAlbumListing({ entry, sources, now: NOW + 1 })
  }

  it('counts the photos and bytes across every volume once all were listed', () => {
    const listing = read({
      buffer: [file('a', { size: '300' })],
      master: [file('b', { size: '100' })],
      'flamekeeper:amina': [file('c', { size: '50' })],
    })
    expect(listingTotals(listing)).toEqual({ count: 3, bytes: 450 })
  })

  it('is a real zero for an album that is empty everywhere', () => {
    expect(listingTotals(read({}))).toEqual({ count: 0, bytes: 0 })
  })

  it('gives no totals while a volume could not be listed, so the stored ones are not overwritten with a low number', () => {
    const listing = read(
      { buffer: [file('a')] },
      { buffer: { kind: 'failed' } }
    )
    expect(listingTotals(listing)).toBeNull()
  })

  it('gives no totals when the album folder is in the bin', () => {
    const sources = sourcesOf()
    const entry = applyListingOutcomes({
      sources,
      entry: null,
      now: NOW,
      folderState: 'trashed',
      outcomes: {},
    })
    expect(
      listingTotals(readAlbumListing({ entry, sources, now: NOW }))
    ).toBeNull()
  })
})

describe('newerListingEntry', () => {
  const entry = (listedAt: number) => ({
    folderState: 'ok' as const,
    sources: {
      master: {
        folderId: 'f',
        stamp: '',
        status: 'ok' as const,
        listedAt,
        failedAt: null,
        files: [],
      },
    },
  })

  it('prefers the entry that was listed last', () => {
    expect(newerListingEntry(entry(1), entry(2))).toEqual(entry(2))
    expect(newerListingEntry(entry(5), entry(2))).toEqual(entry(5))
  })

  it('falls back to whichever entry exists', () => {
    expect(newerListingEntry(null, entry(2))).toEqual(entry(2))
    expect(newerListingEntry(entry(2), null)).toEqual(entry(2))
    expect(newerListingEntry(null, null)).toBeNull()
  })
})

describe('stamp-driven listing during an upload burst', () => {
  const bufferSource = (changedAt: number | null, expectedCount = 3) =>
    sourcesOf({
      bufferVolume: {
        driveFolderId: 'buffer-folder',
        expectedCount,
        expectedBytes: 300,
        expectedChangedAt: changedAt,
      },
    })

  const listedEntry = (listedAt: number): AlbumListingEntry =>
    applyListingOutcomes({
      sources: bufferSource(null, 2),
      entry: null,
      now: listedAt,
      folderState: 'ok',
      outcomes: {
        buffer: {
          kind: 'listed',
          files: [file('a'), file('b')],
          complete: true,
        },
        master: { kind: 'listed', files: [], complete: true },
      },
    })

  const actionOf = (
    changedAt: number | null,
    now: number,
    extra: { strictStamp?: boolean } = {}
  ) =>
    planListingRefresh({
      sources: bufferSource(changedAt),
      entry: listedEntry(NOW),
      now,
      ...extra,
    }).actions.buffer

  it('reuses a listing that is a few minutes old while uploads keep arriving', () => {
    expect(actionOf(NOW + 110_000, NOW + 2 * 60_000)).toBe('reuse')
  })

  it('lists again once the burst has gone quiet, so a finished upload shows up', () => {
    expect(actionOf(NOW + 60_000, NOW + 60_000 + LISTING_SETTLE_MS)).toBe(
      'list'
    )
  })

  it('lists again at most five minutes into a continuing burst', () => {
    expect(
      actionOf(NOW + LISTING_STAMP_THROTTLE_MS, NOW + LISTING_STAMP_THROTTLE_MS)
    ).toBe('list')
  })

  it('lists at once for the duplicate check, which must see new uploads', () => {
    expect(
      actionOf(NOW + 110_000, NOW + 2 * 60_000, { strictStamp: true })
    ).toBe('list')
  })

  it('lists at once when no upload time is known', () => {
    expect(actionOf(null, NOW + 60_000)).toBe('list')
  })

  it('marks a throttled volume as behind its expected values', () => {
    const volumes = readAlbumListing({
      entry: listedEntry(NOW),
      sources: bufferSource(NOW + 60_000),
      now: NOW + 2 * 60_000,
    }).volumes
    expect(volumes.find((v) => v.key === 'buffer')?.stampStale).toBe(true)
  })
})
