import { useNavigate, useSearch } from '@tanstack/react-router'
import { Images } from 'lucide-react'
import { albumQueries } from '@/lib/albums'
import type { AlbumListFilters } from '@/lib/albums'
import type { UserProfile } from '@/lib/user/types'
import { AuthenticatedShell } from '@/components/root/authenticated-shell'
import { PublicAlbumsLayout } from '@/components/albums/public-layout'
import { InfiniteAlbumGroupedList } from '@/components/albums/album-sections'
import { AlbumToolbar } from '@/components/albums/album-toolbar'
import { useAlbumList } from '@/components/albums/use-album-list'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { SplashText } from '@/components/layout/splash-text'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'

interface PublicAlbumsIndexProps {
  user: UserProfile | null
}

export function PublicAlbumsIndex({ user }: PublicAlbumsIndexProps) {
  const navigate = useNavigate({ from: '/albums/' })
  const search = useSearch({ from: '/albums/' })

  const { albums, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useAlbumList(albumQueries.public(search))

  const filters: AlbumListFilters = {
    search: search.search,
    ownership: [],
  }

  const handleFiltersChange = (next: Partial<AlbumListFilters>) => {
    navigate({ search: { search: next.search ?? '' }, replace: true })
  }

  const content = (
    <PageContainer>
      <PageHeader title="Albums" description={<SplashText />} />

      <AlbumToolbar
        filters={filters}
        onFiltersChange={handleFiltersChange}
        showOwnership={false}
      />

      {albums.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Images />
            </EmptyMedia>
            <EmptyTitle>No public albums yet</EmptyTitle>
            <EmptyDescription>
              {search.search
                ? 'No public albums match your search.'
                : 'Albums will appear here once members create them.'}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <InfiniteAlbumGroupedList
          albums={albums}
          hasNextPage={hasNextPage}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
        />
      )}
    </PageContainer>
  )

  if (user) {
    return <AuthenticatedShell user={user}>{content}</AuthenticatedShell>
  }

  return <PublicAlbumsLayout>{content}</PublicAlbumsLayout>
}
