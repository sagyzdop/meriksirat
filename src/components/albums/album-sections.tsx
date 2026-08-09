import * as React from 'react'
import { Images, Loader2 } from 'lucide-react'
import type { AlbumSummary } from '@/lib/albums'
import { AlbumCard } from './album-card'

interface AlbumGroupedListProps {
  albums: AlbumSummary[]
  showPrivacy?: boolean
}

interface YearSection {
  year: number
  months: {
    month: string
    albums: AlbumSummary[]
  }[]
}

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  timeZone: 'UTC',
})

/**
 * Group albums by their (UTC) creation year and month, newest first. Matches
 * the Albums/<year>/<month> folder layout in Google Drive and stays
 * deterministic between server and client renders.
 */
export function groupAlbumsByYearMonth(albums: AlbumSummary[]): YearSection[] {
  const byYear = new Map<number, Map<number, AlbumSummary[]>>()

  for (const album of albums) {
    const date = new Date(album.createdAt)
    if (Number.isNaN(date.getTime())) continue
    const year = date.getUTCFullYear()
    const month = date.getUTCMonth()

    let months = byYear.get(year)
    if (!months) {
      months = new Map()
      byYear.set(year, months)
    }
    const list = months.get(month) ?? []
    list.push(album)
    months.set(month, list)
  }

  return [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, months]) => ({
      year,
      months: [...months.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([monthIndex, list]) => ({
          month: monthFormatter.format(new Date(Date.UTC(2000, monthIndex, 1))),
          albums: list,
        })),
    }))
}

export function AlbumGroupedList({
  albums,
  showPrivacy = false,
}: AlbumGroupedListProps) {
  const sections = React.useMemo(() => groupAlbumsByYearMonth(albums), [albums])

  if (sections.length === 0) return null

  return (
    <div className="space-y-10">
      {sections.map(({ year, months }) => (
        <section key={year} aria-labelledby={`album-year-${year}`}>
          <div className="mb-4 flex items-center gap-2">
            <h2
              id={`album-year-${year}`}
              className="text-2xl font-bold tracking-tight"
            >
              {year}
            </h2>
            <span className="text-sm text-muted-foreground">
              {months.reduce((sum, m) => sum + m.albums.length, 0)} album
              {months.reduce((sum, m) => sum + m.albums.length, 0) !== 1
                ? 's'
                : ''}
            </span>
          </div>

          <div className="space-y-8">
            {months.map(({ month, albums: monthAlbums }) => (
              <div key={month}>
                <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  <Images className="size-3.5" aria-hidden="true" />
                  {month}
                  <span aria-hidden="true">·</span>
                  <span className="font-normal normal-case">
                    {monthAlbums.length}
                  </span>
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {monthAlbums.map((album) => (
                    <AlbumCard
                      key={album.id}
                      album={album}
                      showPrivacy={showPrivacy}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

interface InfiniteAlbumGroupedListProps {
  albums: AlbumSummary[]
  showPrivacy?: boolean
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

/**
 * Paginated album grid that loads the next page when the sentinel near the
 * bottom becomes visible (infinite scroll).
 */
export function InfiniteAlbumGroupedList({
  albums,
  showPrivacy = false,
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: InfiniteAlbumGroupedListProps) {
  const sentinelRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) fetchNextPage()
      },
      { rootMargin: '600px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, albums.length])

  return (
    <div>
      <AlbumGroupedList albums={albums} showPrivacy={showPrivacy} />
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      {isFetchingNextPage && (
        <div className="flex justify-center py-8 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" />
        </div>
      )}
      {!hasNextPage && albums.length > 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          You&apos;ve reached the end.
        </p>
      )}
    </div>
  )
}
