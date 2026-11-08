import { Table, TableBody } from '@/components/ui/table'
import { DetailRow } from '@/components/shared/detail-row'
import { AlbumStatusBadge } from '@/components/albums/album-status-badge'
import { formatBytes, formatUtcDate } from '@/lib/format'
import { albumViewUrl } from '@/lib/albums/share'
import type { AlbumDetail } from '@/lib/albums/types'

const folderStateLabel: Record<AlbumDetail['folderState'], string> = {
  ok: 'OK',
  trashed: 'In the Drive bin',
  missing: 'Deleted from Drive',
}

const holderLabel = (album: AlbumDetail) => {
  if (album.storage.holder === 'buffer') return 'Buffer'
  if (album.storage.holder === 'flamekeeper') return 'Flamekeepers'
  return 'Unknown'
}

export function AlbumOverview({
  album,
  photoBytes,
  ownerName,
}: {
  album: AlbumDetail
  photoBytes: number
  ownerName: string
}) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const publicUrl = albumViewUrl(origin, album.id)
  const editUrl = album.editShareToken
    ? `${publicUrl}?edit=${album.editShareToken}`
    : null

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableBody>
          <DetailRow label="Description" valueClassName="whitespace-normal">
            {album.description || '—'}
          </DetailRow>
          <DetailRow label="Event">{album.event || '—'}</DetailRow>
          <DetailRow label="Event date">
            {formatUtcDate(album.eventDate)}
          </DetailRow>
          <DetailRow label="Owner">{ownerName}</DetailRow>
          <DetailRow label="Created">
            {formatUtcDate(album.createdAt)}
          </DetailRow>
          <DetailRow label="Status">
            <AlbumStatusBadge status={album.status} />
          </DetailRow>
          {album.scheduledDeletionAt && (
            <DetailRow label="Deletes on">
              {formatUtcDate(album.scheduledDeletionAt)}
            </DetailRow>
          )}
          <DetailRow label="Photos">{album.photos.length}</DetailRow>
          <DetailRow label="Size">{formatBytes(photoBytes)}</DetailRow>
          <DetailRow label="Storage">{holderLabel(album)}</DetailRow>
          <DetailRow label="Folder state">
            {folderStateLabel[album.folderState]}
          </DetailRow>
          <DetailRow label="Public link" valueClassName="break-all">
            <a
              href={publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {publicUrl}
            </a>
          </DetailRow>
          <DetailRow label="Edit link" valueClassName="break-all">
            {editUrl ? (
              <a
                href={editUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {editUrl}
              </a>
            ) : (
              '—'
            )}
          </DetailRow>
        </TableBody>
      </Table>
    </div>
  )
}
