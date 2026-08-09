import * as React from 'react'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLocation, useNavigate } from '@tanstack/react-router'
import {
  revealUploadDetails,
  useUploads,
} from '@/lib/albums/upload-manager'
import { cn } from '@/lib/utils'

export function SiteHeader() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname
  const jobs = useUploads()

  const active = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'uploading'
  )
  const finished = jobs.filter(
    (j) => j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
  )
  const total = jobs.length
  const doneCount = finished.length
  const overall =
    total === 0 ? 0 : Math.round((doneCount / total) * 100)

  // Get current page name based on pathname
  const getPageName = () => {
    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'equipment')) {
      return 'Equipment'
    }

    const section = segments[0]

    switch (section) {
      case 'bookings':
        if (segments.length === 1) return 'My Bookings'
        if (segments[1] === 'new') return 'New Booking'
        if (segments[1] === 'edit') return 'Edit Booking'
        return 'Booking Details'

      case 'equipment':
        if (segments.length === 1) return 'Equipment'
        return 'Equipment Details'

      case 'admin':
        if (segments.length === 1) return 'Admin'
        if (segments[1] === 'dashboard') return 'Admin Dashboard'
        if (segments[1] === 'users') return 'User Management'
        if (segments[1] === 'equipment') return 'Equipment Management'
        if (segments[1] === 'albums') return 'Album Management'
        if (segments[1] === 'categories') return 'Category Management'
        if (segments[1] === 'bookings') return 'Booking Oversight'
        if (segments[1] === 'settings') return 'Admin Settings'
        return 'Admin'

      case 'profile':
        return 'My Profile'

      case 'faq':
        return 'FAQ'

      case 'dashboard':
        return 'Dashboard'

      default:
        return section.charAt(0).toUpperCase() + section.slice(1)
    }
  }

  const pageName = getPageName()

  // Group jobs by album so the widget can list every album being uploaded to.
  const byAlbum = React.useMemo(() => {
    const groups = new Map<
      string,
      { albumId: string; albumTitle: string; jobs: (typeof jobs)[number][] }
    >()
    for (const job of jobs) {
      const group = groups.get(job.albumId) ?? {
        albumId: job.albumId,
        albumTitle: job.albumTitle,
        jobs: [],
      }
      group.jobs.push(job)
      groups.set(job.albumId, group)
    }
    return [...groups.values()]
  }, [jobs])

  const openAlbumUploads = (albumId: string) => {
    revealUploadDetails(albumId)
    navigate({ to: `/albums/${albumId}` })
  }

  return (
    <header className="sticky top-0 z-10 flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-background transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mx-2 data-[orientation=vertical]:h-4"
        />
        <h1 className="text-base font-medium">{pageName}</h1>
        <div className="ml-auto flex items-center gap-2">
          {active.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex w-40 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-muted"
                  title="View uploads"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Uploading</span>
                    <span>
                      {doneCount}/{total} · {overall}%
                    </span>
                  </div>
                  <Progress
                    value={overall}
                    className={cn(overall < 100 && 'bg-primary/15')}
                  />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {byAlbum.length > 1 && (
                  <>
                    <DropdownMenuLabel className="font-normal text-muted-foreground">
                      {byAlbum.length} albums uploading
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                  </>
                )}
                {byAlbum.map((group) => {
                  const groupActive = group.jobs.filter(
                    (j) => j.status === 'queued' || j.status === 'uploading'
                  ).length
                  const groupDone = group.jobs.filter(
                    (j) => j.status === 'done'
                  ).length
                  const groupOverall =
                    group.jobs.length === 0
                      ? 0
                      : Math.round((groupDone / group.jobs.length) * 100)
                  return (
                    <DropdownMenuItem
                      key={group.albumId}
                      className="flex flex-col items-stretch gap-1.5 py-2.5"
                      onSelect={() => openAlbumUploads(group.albumId)}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate font-medium">
                          {group.albumTitle}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {groupActive > 0
                            ? `${groupDone}/${group.jobs.length}`
                            : 'done'}
                        </span>
                      </span>
                      <Progress
                        value={groupOverall}
                        className="h-1.5 bg-primary/15"
                      />
                    </DropdownMenuItem>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </header>
  )
}
