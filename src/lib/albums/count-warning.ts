import { LISTING_FRESH_MS } from './listing'
import type { AlbumListing, VolumeListing } from './listing'

export const IN_FLIGHT_UPLOAD_MS = 10 * 60 * 1000

export interface VolumeTotals {
  count: number
  bytes: number
}

export interface CountWarningVolume {
  key: string
  listed: VolumeTotals
  expected: VolumeTotals
  admin: {
    folderId: string
    holder: 'buffer' | 'flamekeeper'
    flamekeeperUserId: string | null
  } | null
}

export interface CountWarning {
  volumes: CountWarningVolume[]
}

export interface CountWarningViewer {
  isOwner: boolean
  isAdmin: boolean
}

function trustworthy(listing: AlbumListing, now: number): boolean {
  return (
    listing.folderState === 'ok' &&
    listing.complete &&
    listing.volumes.every(
      (v) =>
        v.status === 'missing' ||
        (v.status === 'ok' &&
          v.listedAt !== null &&
          now - v.listedAt <= LISTING_FRESH_MS)
    )
  )
}

function isShort(volume: VolumeListing): boolean {
  const expected = volume.expected
  if (!expected) return false
  if (volume.status !== 'ok') return false
  return volume.count < expected.count || volume.bytes < expected.bytes
}

export function planCountWarning(input: {
  listing: AlbumListing
  viewer: CountWarningViewer
  now: number
}): CountWarning | null {
  const { listing, viewer, now } = input
  if (!viewer.isOwner && !viewer.isAdmin) return null
  if (!trustworthy(listing, now)) return null
  const volumes: CountWarningVolume[] = []
  for (const volume of listing.volumes) {
    if (!isShort(volume) || !volume.expected) continue
    volumes.push({
      key: volume.key,
      listed: { count: volume.count, bytes: volume.bytes },
      expected: volume.expected,
      admin: viewer.isAdmin
        ? {
            folderId: volume.folderId,
            holder: volume.owner.kind === 'buffer' ? 'buffer' : 'flamekeeper',
            flamekeeperUserId:
              volume.owner.kind === 'flamekeeper' ? volume.owner.userId : null,
          }
        : null,
    })
  }
  return volumes.length > 0 ? { volumes } : null
}

export type AcceptPlan =
  { ok: true; expected: VolumeTotals } | { ok: false; message: string }

function createdMs(file: { createdTime?: string }): number | null {
  if (!file.createdTime) return null
  const ms = Date.parse(file.createdTime)
  return Number.isNaN(ms) ? null : ms
}

export function planAccept(input: {
  listing: AlbumListing
  volumeKey: string
  now: number
}): AcceptPlan {
  const { listing, volumeKey, now } = input
  if (!trustworthy(listing, now)) {
    return {
      ok: false,
      message:
        'Google Drive could not be fully read just now, so nothing was changed. Please try again later.',
    }
  }
  const volume = listing.volumes.find((v) => v.key === volumeKey)
  if (!volume || !volume.expected || !isShort(volume)) {
    return {
      ok: false,
      message: 'This volume has no fewer-photos warning to accept.',
    }
  }
  let count = 0
  let bytes = 0
  for (const file of volume.files) {
    const created = createdMs(file)
    if (created !== null && now - created < IN_FLIGHT_UPLOAD_MS) continue
    count += 1
    bytes += Number(file.size ?? 0) || 0
  }
  return {
    ok: true,
    expected: {
      count: Math.min(count, volume.expected.count),
      bytes: Math.min(bytes, volume.expected.bytes),
    },
  }
}
