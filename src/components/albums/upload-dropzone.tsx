import * as React from 'react'
import {
  AlertCircle,
  Check,
  ChevronDown,
  CloudUpload,
  RefreshCw,
  Upload,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  uploadManager,
  useUploadReveal,
  clearUploadReveal,
  useUploads,
  type UploadJob,
} from '@/lib/albums/upload-manager'
import { cn } from '@/lib/utils'
import { formatBytes } from '@/lib/format'

interface UploadDropzoneProps {
  albumId: string
  albumTitle: string
  existingNames?: string[]
  onUploaded: () => void
}

function jobDescription(job: UploadJob): string {
  switch (job.status) {
    case 'queued':
      return `${formatBytes(job.size)} · queued`
    case 'uploading':
      return `Uploading · ${job.progress}%`
    case 'done':
      return `${formatBytes(job.size)} · uploaded`
    case 'error':
      return job.error ?? 'Upload failed'
    case 'cancelled':
      return 'Cancelled'
  }
}

function statusDot(job: UploadJob): string {
  switch (job.status) {
    case 'queued':
      return 'bg-muted-foreground/50'
    case 'uploading':
      return 'bg-primary animate-pulse'
    case 'done':
      return 'bg-green-500'
    case 'error':
      return 'bg-destructive'
    case 'cancelled':
      return 'bg-muted-foreground/30'
  }
}

export function UploadDropzone({
  albumId,
  albumTitle,
  existingNames = [],
  onUploaded,
}: UploadDropzoneProps) {
  const [dragging, setDragging] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [detailsOpen, setDetailsOpen] = React.useState(true)
  const [skippedNotice, setSkippedNotice] = React.useState<string[]>([])
  const inputRef = React.useRef<HTMLInputElement>(null)

  const allJobs = useUploads()
  const jobs = React.useMemo(
    () => allJobs.filter((j) => j.albumId === albumId),
    [allJobs, albumId]
  )

  const activeCount = jobs.filter(
    (j) => j.status === 'queued' || j.status === 'uploading'
  ).length
  const doneCount = jobs.filter((j) => j.status === 'done').length
  const finishedCount = jobs.length - activeCount
  const prevFinishedRef = React.useRef(finishedCount)

  const totalBytes = jobs.reduce((sum, j) => sum + j.size, 0)
  const loadedBytes = jobs.reduce((sum, j) => {
    if (j.status === 'done') return sum + j.size
    if (j.status === 'uploading') return sum + (j.size * j.progress) / 100
    return sum
  }, 0)
  const overall =
    totalBytes === 0 ? 0 : Math.round((loadedBytes / totalBytes) * 100)

  const reveal = useUploadReveal()

  React.useEffect(() => {
    if (reveal.albumId === albumId && reveal.nonce > 0) {
      setDetailsOpen(true)
      clearUploadReveal()
    }
  }, [reveal, albumId])

  React.useEffect(() => {
    if (
      jobs.length > 0 &&
      activeCount === 0 &&
      finishedCount > prevFinishedRef.current
    ) {
      prevFinishedRef.current = finishedCount
      onUploaded()
    }
  }, [activeCount, finishedCount, jobs.length, onUploaded])

  const upload = async (fileList: FileList | File[]) => {
    const imageFiles = Array.from(fileList).filter(
      (f) => f.type.startsWith('image/') || f.type === ''
    )
    if (imageFiles.length === 0) {
      toast.error('Please choose image files')
      return
    }

    setStarting(true)
    const { accepted, skipped } = uploadManager.enqueue(
      albumId,
      albumTitle,
      imageFiles,
      new Set(existingNames)
    )
    setStarting(false)
    setDetailsOpen(accepted.length <= 8)

    if (skipped.length > 0) {
      setSkippedNotice(skipped)
      if (accepted.length === 0) {
        toast.warning(
          skipped.length === 1
            ? `"${skipped[0]}" is already in the album`
            : `${skipped.length} photos skipped — already in the album`
        )
        return
      }
      toast.info(
        `${skipped.length} duplicate${skipped.length > 1 ? 's' : ''} skipped — already in the album`
      )
    }
    onUploaded()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
  }

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
          dragging ? 'border-primary bg-muted/50' : 'border-border'
        )}
      >
        <CloudUpload className="text-muted-foreground size-8" />
        <div className="text-sm">
          <span className="font-medium">Drag &amp; drop photos here</span>{' '}
          <span className="text-muted-foreground">or</span>
        </div>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => inputRef.current?.click()}
          disabled={starting}
        >
          <Upload />
          Choose photos
        </Button>
        <p className="text-xs text-muted-foreground">
          Uploads go directly to Google Drive.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) upload(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {skippedNotice.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {skippedNotice.length === 1 ? (
              <>
                Skipped{' '}
                <span className="font-medium text-foreground">
                  {skippedNotice[0]}
                </span>{' '}
                — already in the album.
              </>
            ) : (
              <>Skipped {skippedNotice.length} photos — already in the album.</>
            )}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="shrink-0 text-muted-foreground"
            onClick={() => setSkippedNotice([])}
            aria-label="Dismiss skipped notice"
          >
            <X />
          </Button>
        </div>
      )}

      {jobs.length > 0 && (
        <div className="rounded-xl border bg-card">
          <div className="flex items-center gap-3 p-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-medium">Uploading photos</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {doneCount}/{jobs.length} · {overall}%
                </span>
              </div>
              <Progress value={overall} className="mt-2 bg-primary/15" />
            </div>
            {finishedCount > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => uploadManager.clear(albumId)}
              >
                Clear finished
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => setDetailsOpen((o) => !o)}
              aria-expanded={detailsOpen}
              aria-label={detailsOpen ? 'Hide upload list' : 'Show upload list'}
            >
              <ChevronDown
                className={cn(
                  'size-4 transition-transform',
                  detailsOpen && 'rotate-180'
                )}
              />
            </Button>
          </div>
          {detailsOpen && (
            <ul className="max-h-64 overflow-y-auto border-t">
              {jobs.map((job) => (
                <li
                  key={job.id}
                  className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      statusDot(job)
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{job.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {jobDescription(job)}
                  </span>
                  {job.status === 'queued' || job.status === 'uploading' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => uploadManager.cancel(job.id)}
                      aria-label={`Cancel ${job.name}`}
                    >
                      <X />
                    </Button>
                  ) : job.status === 'error' ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => uploadManager.retry(job.id)}
                      aria-label={`Retry ${job.name}`}
                    >
                      <RefreshCw />
                    </Button>
                  ) : (
                    <span className="text-muted-foreground/60">
                      <Check
                        className="size-4"
                        aria-label={
                          job.status === 'done' ? 'Uploaded' : 'Cancelled'
                        }
                      />
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
