import { describe, expect, it } from 'vitest'
import {
  IN_FLIGHT_UPLOAD_MS,
  planAccept,
  planCountWarning,
} from '@/lib/albums/count-warning'
import { LISTING_FRESH_MS } from '@/lib/albums/listing'
import type {
  AlbumListing,
  ListingFile,
  VolumeListing,
} from '@/lib/albums/listing'

const NOW = 1_800_000_000_000
const OLD = new Date(NOW - 3 * 60 * 60 * 1000).toISOString()

function file(id: string, size = 100, createdTime = OLD): ListingFile {
  return {
    id,
    name: `${id}.jpg`,
    mimeType: 'image/jpeg',
    size: `${size}`,
    createdTime,
  }
}

function bufferVolume(
  files: ListingFile[],
  expected: { count: number; bytes: number } | null,
  extra: Partial<VolumeListing> = {}
): VolumeListing {
  return {
    key: 'buffer',
    owner: { kind: 'buffer' },
    folderId: 'buffer-folder',
    status: 'ok',
    listedAt: NOW - 1000,
    files,
    count: files.length,
    bytes: files.reduce((s, f) => s + Number(f.size), 0),
    expected,
    ...extra,
  }
}

function masterVolume(extra: Partial<VolumeListing> = {}): VolumeListing {
  return {
    key: 'master',
    owner: { kind: 'master' },
    folderId: 'album-folder',
    status: 'ok',
    listedAt: NOW - 1000,
    files: [],
    count: 0,
    bytes: 0,
    expected: null,
    ...extra,
  }
}

function listing(
  volumes: VolumeListing[],
  extra: Partial<AlbumListing> = {}
): AlbumListing {
  return {
    folderState: 'ok',
    complete: volumes.every((v) => v.status === 'ok'),
    files: volumes.flatMap((v) => v.files),
    volumes,
    ...extra,
  }
}

const OWNER = { isOwner: true, isAdmin: false }
const ADMIN = { isOwner: false, isAdmin: true }
const OTHER = { isOwner: false, isAdmin: false }

const short = () =>
  listing([
    bufferVolume([file('a'), file('b')], { count: 3, bytes: 300 }),
    masterVolume(),
  ])

describe('planCountWarning', () => {
  it('warns when fewer photos are listed than expected', () => {
    const w = planCountWarning({ listing: short(), viewer: OWNER, now: NOW })
    expect(w?.volumes).toHaveLength(1)
    expect(w?.volumes[0].listed).toEqual({ count: 2, bytes: 200 })
    expect(w?.volumes[0].expected).toEqual({ count: 3, bytes: 300 })
  })

  it('warns when the count matches but the bytes are lower', () => {
    const l = listing([
      bufferVolume([file('a', 50), file('b', 50)], { count: 2, bytes: 200 }),
    ])
    expect(
      planCountWarning({ listing: l, viewer: OWNER, now: NOW })
    ).not.toBeNull()
  })

  it('stays quiet when listed matches expected', () => {
    const l = listing([
      bufferVolume([file('a'), file('b')], { count: 2, bytes: 200 }),
    ])
    expect(planCountWarning({ listing: l, viewer: ADMIN, now: NOW })).toBeNull()
  })

  it('never warns for files added by hand, which only raise the listing', () => {
    const l = listing([
      bufferVolume([file('a'), file('b'), file('hand', 500)], {
        count: 2,
        bytes: 200,
      }),
    ])
    expect(planCountWarning({ listing: l, viewer: ADMIN, now: NOW })).toBeNull()
  })

  it('never warns for an upload still confirming', () => {
    const l = listing([
      bufferVolume(
        [file('a'), file('new', 100, new Date(NOW - 1000).toISOString())],
        { count: 1, bytes: 100 }
      ),
    ])
    expect(planCountWarning({ listing: l, viewer: OWNER, now: NOW })).toBeNull()
  })

  it('never warns for volumes with no expected values', () => {
    const l = listing([bufferVolume([], null), masterVolume()])
    expect(planCountWarning({ listing: l, viewer: ADMIN, now: NOW })).toBeNull()
  })

  it.each(['partial', 'failed', 'missing', 'unavailable'] as const)(
    'never warns from a %s listing',
    (status) => {
      const l = listing(
        [bufferVolume([file('a')], { count: 3, bytes: 300 }, { status })],
        { complete: false }
      )
      expect(
        planCountWarning({ listing: l, viewer: ADMIN, now: NOW })
      ).toBeNull()
    }
  )

  it('still warns when another volume of the album could not be read', () => {
    const l = listing([
      bufferVolume([file('a')], { count: 3, bytes: 300 }),
      masterVolume({ status: 'failed' }),
    ])
    expect(
      planCountWarning({ listing: l, viewer: ADMIN, now: NOW })?.volumes
    ).toHaveLength(1)
  })

  it('never warns from a listing taken before the latest upload', () => {
    const l = listing([
      bufferVolume([file('a')], { count: 3, bytes: 300 }, { stampStale: true }),
    ])
    expect(planCountWarning({ listing: l, viewer: ADMIN, now: NOW })).toBeNull()
  })

  it('never warns when the album folder is trashed or gone', () => {
    for (const folderState of ['trashed', 'missing'] as const) {
      expect(
        planCountWarning({
          listing: { ...short(), folderState },
          viewer: ADMIN,
          now: NOW,
        })
      ).toBeNull()
    }
  })

  it('never warns from a listing older than the freshness window', () => {
    const l = listing([
      bufferVolume(
        [file('a')],
        { count: 3, bytes: 300 },
        { listedAt: NOW - LISTING_FRESH_MS - 1 }
      ),
    ])
    expect(planCountWarning({ listing: l, viewer: ADMIN, now: NOW })).toBeNull()
  })

  it('shows nothing to people who are neither owner nor admin', () => {
    expect(
      planCountWarning({ listing: short(), viewer: OTHER, now: NOW })
    ).toBeNull()
  })

  it('gives the volume link and holder to admins only', () => {
    const owner = planCountWarning({
      listing: short(),
      viewer: OWNER,
      now: NOW,
    })
    expect(owner?.volumes[0].admin).toBeNull()
    expect(JSON.stringify(owner)).not.toContain('buffer-folder')

    const admin = planCountWarning({
      listing: short(),
      viewer: ADMIN,
      now: NOW,
    })
    expect(admin?.volumes[0].admin).toEqual({
      folderId: 'buffer-folder',
      holder: 'buffer',
      flamekeeperUserId: null,
    })
  })

  it('an admin who also owns the album still gets the admin details', () => {
    const w = planCountWarning({
      listing: short(),
      viewer: { isOwner: true, isAdmin: true },
      now: NOW,
    })
    expect(w?.volumes[0].admin?.folderId).toBe('buffer-folder')
  })
})

describe('planAccept', () => {
  it('lowers expected to what is listed', () => {
    const plan = planAccept({ listing: short(), volumeKey: 'buffer', now: NOW })
    expect(plan).toEqual({ ok: true, expected: { count: 2, bytes: 200 } })
  })

  it('never raises expected', () => {
    const l = listing([
      bufferVolume([file('a'), file('hand', 900)], { count: 5, bytes: 400 }),
    ])
    const plan = planAccept({ listing: l, volumeKey: 'buffer', now: NOW })
    expect(plan).toEqual({ ok: true, expected: { count: 2, bytes: 400 } })
  })

  it('leaves out files young enough to still be confirming', () => {
    const young = new Date(NOW - IN_FLIGHT_UPLOAD_MS + 1000).toISOString()
    const l = listing([
      bufferVolume([file('a'), file('new', 100, young)], {
        count: 3,
        bytes: 300,
      }),
    ])
    expect(planAccept({ listing: l, volumeKey: 'buffer', now: NOW })).toEqual({
      ok: true,
      expected: { count: 1, bytes: 100 },
    })
  })

  it('refuses an incomplete listing', () => {
    const l = listing(
      [
        bufferVolume(
          [file('a')],
          { count: 3, bytes: 300 },
          { status: 'partial' }
        ),
      ],
      { complete: false }
    )
    expect(planAccept({ listing: l, volumeKey: 'buffer', now: NOW }).ok).toBe(
      false
    )
  })

  it('refuses when there is no warning to accept', () => {
    const l = listing([bufferVolume([file('a')], { count: 1, bytes: 100 })])
    expect(planAccept({ listing: l, volumeKey: 'buffer', now: NOW }).ok).toBe(
      false
    )
    expect(planAccept({ listing: l, volumeKey: 'nope', now: NOW }).ok).toBe(
      false
    )
  })
})
