import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlbumStatusBadge } from '@/components/albums/album-status-badge'
import { ALBUM_STATUSES, ALBUM_STATUS_INFO } from '@/lib/albums/status'

export function AlbumStatusLegend() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Album statuses</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-[auto_1fr] sm:items-center sm:gap-x-4">
          {ALBUM_STATUSES.map((status) => (
            <div key={status} className="contents">
              <dt>
                <AlbumStatusBadge status={status} />
              </dt>
              <dd className="text-sm text-muted-foreground">
                {ALBUM_STATUS_INFO[status].description}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  )
}
