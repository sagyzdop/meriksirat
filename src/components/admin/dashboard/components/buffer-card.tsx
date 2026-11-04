import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import type { BufferUsageOverview } from '@/lib/buffer/functions'
import { BUFFER_WARN_FRACTION } from '@/lib/buffer/usage'
import { formatBytes } from './album-storage-cards'

interface BufferCardProps {
  usage?: BufferUsageOverview | null
  isLoading: boolean
}

export function BufferCard({ usage, isLoading }: BufferCardProps) {
  if (usage === undefined) {
    return isLoading ? <Skeleton className="h-40 w-full rounded-lg" /> : null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buffer usage</CardTitle>
        <CardDescription>
          Admins get a Telegram alert at {BUFFER_WARN_FRACTION * 100}%, and
          uploads stop at 100% until space is freed. Use Free up space below to
          make room.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {usage === null ? (
          <p className="text-sm text-muted-foreground">
            Buffer usage is not available. Check that the buffer account is
            connected.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Used</div>
                <div className="text-2xl font-bold tabular-nums">
                  {formatBytes(usage.usedBytes)}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Plan</div>
                <div className="text-2xl font-bold tabular-nums">
                  {usage.limitBytes ? formatBytes(usage.limitBytes) : 'Unknown'}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Full</div>
                <div
                  className={
                    usage.level === 'ok'
                      ? 'text-2xl font-bold tabular-nums'
                      : 'text-2xl font-bold tabular-nums text-destructive'
                  }
                >
                  {usage.percent === null ? 'Unknown' : `${usage.percent}%`}
                </div>
              </div>
            </div>
            <Progress value={usage.percent ?? 0} />
            {usage.level === 'full' ? (
              <p className="text-sm text-destructive">
                The buffer is full. Uploads are paused.
              </p>
            ) : usage.level === 'warn' ? (
              <p className="text-sm text-destructive">
                The buffer is over 90% full. Free up space or recruit
                flamekeepers.
              </p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}
