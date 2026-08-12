import * as React from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Progress } from '@/components/ui/progress'
import { X } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  revealUploadDetails,
  uploadManager,
  useUploads,
} from '@/lib/albums/upload-manager'
import { cn } from '@/lib/utils'

export function UploadProgressWidget() {
  const navigate = useNavigate()
  const jobs = useUploads()

  const active = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'uploading'
  )
  const finished = jobs.filter(
    (j) =>
      j.status === 'done' || j.status === 'error' || j.status === 'cancelled'
  )
  const total = jobs.length
  const doneCount = finished.length
  const overall = total === 0 ? 0 : Math.round((doneCount / total) * 100)

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

  if (total === 0) return null

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex w-40 flex-col gap-1 rounded-lg p-1 text-left transition-colors hover:bg-muted"
          title="View uploads"
        >
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{active.length > 0 ? 'Uploading' : 'Uploads'}</span>
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
              {byAlbum.length} albums with uploads
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
          </>
        )}
        {byAlbum.map((group) => {
          const groupActive = group.jobs.filter(
            (j) => j.status === 'queued' || j.status === 'uploading'
          ).length
          const groupDone = group.jobs.filter((j) => j.status === 'done').length
          const groupFinished = group.jobs.length - groupActive
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
                <span className="flex shrink-0 items-center gap-1.5">
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {groupActive > 0
                      ? `${groupDone}/${group.jobs.length}`
                      : 'done'}
                  </span>
                  {groupFinished > 0 && (
                    <button
                      type="button"
                      aria-label={`Clear finished uploads for ${group.albumTitle}`}
                      title="Clear finished"
                      className="text-muted-foreground transition-colors hover:text-foreground"
                      onPointerDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation()
                        uploadManager.clear(group.albumId)
                      }}
                    >
                      <X className="size-3.5" />
                    </button>
                  )}
                </span>
              </span>
              <Progress value={groupOverall} className="h-1.5 bg-primary/15" />
            </DropdownMenuItem>
          )
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
