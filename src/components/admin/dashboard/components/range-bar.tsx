import { Button } from '@/components/ui/button'
import { DateRangeFilter } from '@/components/shared/date-range-filter'
import { effectiveDashboardRange } from '@/lib/admin/dashboard-queries'
import type { AdminDashboardRange } from '@/lib/admin/dashboard-types'

export function RangeBar({
  search,
  onChange,
}: {
  search: AdminDashboardRange
  onChange: (range: AdminDashboardRange) => void
}) {
  const hasCustomRange = Boolean(search.startDate || search.endDate)
  const effectiveRange = effectiveDashboardRange(search)

  return (
    <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center md:justify-end">
      {hasCustomRange && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-full text-muted-foreground md:w-auto"
          onClick={() => onChange({})}
        >
          Reset range
        </Button>
      )}
      <DateRangeFilter
        from={effectiveRange.startDate}
        to={effectiveRange.endDate}
        onChange={(range) =>
          onChange({
            startDate: range?.from ? range.from.toISOString() : undefined,
            endDate: range?.to ? range.to.toISOString() : undefined,
          })
        }
        className="w-full md:w-auto"
      />
    </div>
  )
}
