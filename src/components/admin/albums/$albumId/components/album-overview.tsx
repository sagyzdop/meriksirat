import { Table, TableBody } from '@/components/ui/table'
import { DetailRow } from '@/components/shared/detail-row'
import { formatBytes } from '@/lib/format'
import { albumViewUrl } from '@/lib/albums/share'
import type { AlbumDetail } from '@/lib/albums/types'

const folderStateLabel: Record<AlbumDetail['folderState'], string> = {
  ok: 'OK',
  trashed: 'In the Drive bin',
  missing: 'Deleted from Drive',
}

const holderLabel = (album: AlbumDetail) => {
  if (album.storage.holder === 'buffer') return 'Buffer'
  if (album.storage.holder === 'flamekeeper') {
    return album.storage.flamekeeperName ?? 'Flamekeeper'
  }
  return 'Unknown'
}

export function AlbumOverview({
  album,
  photoBytes,
}: {
  album: AlbumDetail
  photoBytes: number
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
          <DetailRow label="Photos">{album.photos.length}</DetailRow>
          <DetailRow label="Size">{formatBytes(photoBytes)}</DetailRow>
          <DetailRow label="Holder">{holderLabel(album)}</DetailRow>
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
