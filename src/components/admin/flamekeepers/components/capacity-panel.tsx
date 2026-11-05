// PROTOTYPE: capacity block for the flamekeepers admin screen. It replaces the
// dashboard pool card with a plain data table, as requested.
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DetailRow } from '@/components/shared/detail-row'
import { Section } from '@/components/layout/section'
import { useAsyncAction } from '@/hooks/use-async-action'
import { adminDashboardQueries } from '@/lib/admin/dashboard-queries'
import {
  setFlamekeeperCapFn,
  type PoolOverview,
} from '@/lib/admin/functions/pool'
import { bytesToGb, formatGb } from '@/lib/flamekeeper/rules'
import { POOL_LOW_FRACTION, isPoolLow } from '@/lib/pool/placement'

interface CapacityPanelProps {
  pool?: PoolOverview
  isLoading?: boolean
  canEditCap?: boolean
  layout?: 'row' | 'column'
}

function CapEditor({ capBytes }: { capBytes: number }) {
  const queryClient = useQueryClient()
  const [capGb, setCapGb] = useState(String(Math.round(bytesToGb(capBytes))))
  const { pending: isSaving, run } = useAsyncAction()

  useEffect(() => {
    setCapGb(String(Math.round(bytesToGb(capBytes))))
  }, [capBytes])

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

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="space-y-1">
        <Label htmlFor="flamekeeper-admin-cap">Per-account cap (GB)</Label>
        <Input
          id="flamekeeper-admin-cap"
          type="number"
          min={1}
          className="h-8 w-32"
          value={capGb}
          onChange={(event) => setCapGb(event.target.value)}
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
  )
}

export function CapacityPanel({
  pool,
  isLoading = false,
  canEditCap = false,
  layout = 'row',
}: CapacityPanelProps) {
  const low = pool ? isPoolLow(pool) : false

  return (
    <Section
      title="Capacity pledged"
      description={`Space lent by active and full flamekeepers. Free space turns red below ${POOL_LOW_FRACTION * 100}% of the pledged total.`}
      spacing="compact"
    >
      {!pool ? (
        isLoading ? (
          <Skeleton className="h-24 w-full rounded-md" />
        ) : (
          <p className="text-sm text-muted-foreground">
            Capacity is unavailable.
          </p>
        )
      ) : layout === 'row' ? (
        <div className="space-y-4">
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Pledged</TableHead>
                  <TableHead>Used</TableHead>
                  <TableHead>Free</TableHead>
                  <TableHead>Flamekeepers</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-lg font-semibold tabular-nums">
                    {formatGb(pool.pledgedBytes)}
                  </TableCell>
                  <TableCell className="text-lg font-semibold tabular-nums">
                    {formatGb(pool.usedBytes)}
                  </TableCell>
                  <TableCell
                    className={`text-lg font-semibold tabular-nums ${
                      low ? 'text-destructive' : ''
                    }`}
                  >
                    {formatGb(pool.freeBytes)}
                    {low && (
                      <Badge variant="destructive" className="ml-2">
                        Low
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-lg font-semibold tabular-nums">
                    {pool.flamekeepers}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          {canEditCap && <CapEditor capBytes={pool.capBytes} />}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-md border">
            <Table>
              <TableBody>
                <DetailRow label="Pledged">
                  {formatGb(pool.pledgedBytes)}
                </DetailRow>
                <DetailRow label="Used">{formatGb(pool.usedBytes)}</DetailRow>
                <DetailRow
                  label="Free"
                  valueClassName={low ? 'text-destructive font-medium' : ''}
                >
                  {formatGb(pool.freeBytes)}
                  {low && (
                    <Badge variant="destructive" className="ml-2">
                      Low
                    </Badge>
                  )}
                </DetailRow>
                <DetailRow label="Flamekeepers">{pool.flamekeepers}</DetailRow>
              </TableBody>
            </Table>
          </div>
          {canEditCap && <CapEditor capBytes={pool.capBytes} />}
        </div>
      )}
    </Section>
  )
}
