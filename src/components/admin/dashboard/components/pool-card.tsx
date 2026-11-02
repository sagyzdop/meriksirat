import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAsyncAction } from '@/hooks/use-async-action'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import {
  setFlamekeeperCapFn,
  type PoolOverview,
} from '@/lib/admin/functions/pool'
import { bytesToGb, formatGb } from '@/lib/flamekeeper/rules'
import { POOL_LOW_FRACTION, isPoolLow } from '@/lib/pool/placement'

interface PoolCardProps {
  pool?: PoolOverview
  isLoading: boolean
  canEditCap: boolean
}

export function PoolCard({ pool, isLoading, canEditCap }: PoolCardProps) {
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = useState('')
  const { pending: isSaving, run } = useAsyncAction()

  useEffect(() => {
    if (pool) setCapGb(String(Math.round(bytesToGb(pool.capBytes))))
  }, [pool?.capBytes])

  const handleSave = async () => {
    const value = Number(capGb)
    if (!Number.isFinite(value) || value < 1) {
      toast.error('Enter a cap of at least 1 GB')
      return
    }
    await run(async () => {
      await setFlamekeeperCapFn({ data: { capGb: value } })
      await queryClient.invalidateQueries({
        queryKey: adminDashboardQueries.pool().queryKey,
      })
      toast.success('Per-account cap updated')
    }, 'Failed to save')
  }

  if (!pool) {
    return isLoading ? <Skeleton className="h-40 w-full rounded-lg" /> : null
  }

  const usedPercent =
    pool.pledgedBytes > 0
      ? Math.min(
          100,
          (100 * (pool.pledgedBytes - pool.freeBytes)) / pool.pledgedBytes
        )
      : 100
  const low = isPoolLow(pool)

  return (
    <Card>
      <CardHeader>
        <CardTitle>#savenuimg pool</CardTitle>
        <CardDescription>
          Space lent by {pool.flamekeepers} active or full flamekeeper
          {pool.flamekeepers === 1 ? '' : 's'}. Admins get a Telegram alert when
          free space drops below {POOL_LOW_FRACTION * 100}%.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-muted-foreground">Pledged</div>
            <div className="text-2xl font-bold tabular-nums">
              {formatGb(pool.pledgedBytes)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Used</div>
            <div className="text-2xl font-bold tabular-nums">
              {formatGb(pool.usedBytes)}
            </div>
          </div>
          <div>
            <div className="text-muted-foreground">Free</div>
            <div
              className={
                low
                  ? 'text-2xl font-bold tabular-nums text-destructive'
                  : 'text-2xl font-bold tabular-nums'
              }
            >
              {formatGb(pool.freeBytes)}
            </div>
          </div>
        </div>
        <Progress value={usedPercent} />
        {canEditCap ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="flamekeeper-cap">Per-account cap (GB)</Label>
              <Input
                id="flamekeeper-cap"
                type="number"
                min={1}
                className="w-32"
                value={capGb}
                onChange={(e) => setCapGb(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
