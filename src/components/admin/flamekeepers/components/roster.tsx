import * as React from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronDown, Search } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import { UserAvatar } from '@/components/shared/user-avatar'
import { updateUserAdminFn } from '@/lib/user'
import { USER_STATUSES } from '@/lib/user/types'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { formatGraduationMonth } from '@/lib/graduation-date'
import { lostDeadline } from '@/lib/pool/health'
import { cn, errorMessage } from '@/lib/utils'
import { flamekeeperIssues, relativeTime } from '../issues'
import {
  FLAMEKEEPER_SORT_OPTIONS,
  type FlamekeeperFilters,
  type FlamekeeperSortKey,
} from '../types'
import { StateBadge, StateDot } from './state-badge'

function UsageMeter({
  used,
  pledged,
  className,
}: {
  used: number
  pledged: number
  className?: string
}) {
  if (pledged <= 0) {
    return (
      <span className={cn('text-xs text-muted-foreground', className)}>
        No pledge
      </span>
    )
  }

  const percent = Math.min(100, Math.round((100 * used) / pledged))
  const over = used > pledged

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full',
            over
              ? 'bg-red-500'
              : percent >= 90
                ? 'bg-amber-500'
                : 'bg-foreground/60'
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-[88px] shrink-0 truncate text-right text-[11px] tabular-nums text-muted-foreground">
        {formatGb(used)} / {formatGb(pledged)}
      </span>
    </div>
  )
}

function StatusSelect({
  row,
  onUpdate,
}: {
  row: AdminFlamekeeperRow
  onUpdate: (userId: string, status: string) => void
}) {
  return (
    <Select
      value={row.status ?? undefined}
      onValueChange={(value) => onUpdate(row.userId, value)}
    >
      <SelectTrigger
        size="sm"
        className="h-8 w-28 text-xs"
        aria-label={`Status for ${row.name}`}
      >
        <SelectValue placeholder="—" />
      </SelectTrigger>
      <SelectContent>
        {USER_STATUSES.map((status) => (
          <SelectItem key={status} value={status}>
            {status}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function Fact({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm">{children}</dd>
    </div>
  )
}

function ExpandedFlamekeeper({
  row,
  now,
  canBan,
  viewerId,
  onBan,
  onUnban,
}: {
  row: AdminFlamekeeperRow
  now: Date
  canBan: boolean
  viewerId?: string
  onBan: () => void
  onUnban: () => void
}) {
  const percent =
    row.pledgedBytes > 0
      ? Math.round((100 * row.usedBytes) / row.pledgedBytes)
      : 0

  return (
    <div className="space-y-4 border-t px-1 pb-5 pt-4 sm:pl-12">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
        <Fact label="Pledged">{formatGb(row.pledgedBytes)}</Fact>
        <Fact label="Used">
          {formatGb(row.usedBytes)}{' '}
          <span className="text-muted-foreground">({percent}%)</span>
        </Fact>
        <Fact label="Drive usage">{formatGb(row.driveUsageBytes)}</Fact>
        <Fact label="Albums">{row.albumCount}</Fact>
        <Fact label="State">
          <StateBadge state={row.state} />
        </Fact>
        <Fact label="Graduation">
          {formatGraduationMonth(row.graduationDate) || '—'}
        </Fact>
        <Fact label="Last health check">
          {row.healthCheckedAt
            ? relativeTime(row.healthCheckedAt, now)
            : 'Never'}
        </Fact>
        <Fact label="Flamekeeper since">
          {new Date(row.createdAt).toLocaleDateString(undefined, {
            month: 'short',
            year: 'numeric',
          })}
        </Fact>
        {row.lostSince && (
          <Fact label="Reconnect by">
            {new Date(lostDeadline(row.lostSince)).toLocaleDateString(
              undefined,
              { month: 'short', day: 'numeric', year: 'numeric' }
            )}
          </Fact>
        )}
      </dl>

      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="outline">
          <Link
            to="/admin/flamekeepers/$userId"
            params={{ userId: row.userId }}
          >
            Open full profile
          </Link>
        </Button>
        {canBan && row.userId !== viewerId && (
          <Button
            size="sm"
            variant={row.bannedAt ? 'outline' : 'ghost'}
            className={row.bannedAt ? undefined : 'text-destructive'}
            onClick={row.bannedAt ? onUnban : onBan}
          >
            {row.bannedAt ? 'Unban' : 'Ban'}
          </Button>
        )}
      </div>
    </div>
  )
}

function compareRows(
  a: AdminFlamekeeperRow,
  b: AdminFlamekeeperRow,
  sortBy: FlamekeeperSortKey
): number {
  switch (sortBy) {
    case 'name':
      return a.name.localeCompare(b.name)
    case 'usedBytes':
      return a.usedBytes - b.usedBytes
    case 'graduationDate': {
      if (!a.graduationDate && !b.graduationDate) return 0
      if (!a.graduationDate) return 1
      if (!b.graduationDate) return -1
      return a.graduationDate.localeCompare(b.graduationDate)
    }
    case 'createdAt':
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  }
}

interface FlamekeeperRosterProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperFilters
  isLoading?: boolean
  canBan?: boolean
  viewerId?: string
  expandedId: string | null
  onExpandedChange: (userId: string | null) => void
  now: Date
}

export function FlamekeeperRoster({
  rows,
  filters,
  isLoading = false,
  canBan = false,
  viewerId,
  expandedId,
  onExpandedChange,
  now,
}: FlamekeeperRosterProps) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [banUserId, setBanUserId] = React.useState<string | null>(null)
  const [unbanUserId, setUnbanUserId] = React.useState<string | null>(null)

  const attentionCount = React.useMemo(
    () => rows.filter((row) => flamekeeperIssues(row, now).length > 0).length,
    [rows, now]
  )

  const filtered = React.useMemo(() => {
    const needle = filters.search?.trim().toLowerCase()

    return rows.filter((row) => {
      if (needle) {
        const haystack = `${row.name} ${row.email}`.toLowerCase()
        if (!haystack.includes(needle)) return false
      }
      if (filters.status && row.status !== filters.status) return false
      if (
        filters.attention === '1' &&
        flamekeeperIssues(row, now).length === 0
      ) {
        return false
      }
      return true
    })
  }, [rows, filters.search, filters.status, filters.attention, now])

  const visible = React.useMemo(() => {
    const direction = filters.sortOrder === 'asc' ? 1 : -1
    return [...filtered].sort((a, b) => {
      if (
        filters.sortBy === 'graduationDate' &&
        !a.graduationDate !== !b.graduationDate
      ) {
        return a.graduationDate ? -1 : 1
      }
      return compareRows(a, b, filters.sortBy) * direction
    })
  }, [filtered, filters.sortBy, filters.sortOrder])

  const updateFilters = (patch: Partial<FlamekeeperFilters>) => {
    navigate({ to: '.', search: { ...filters, ...patch } })
  }

  const handleUpdateStatus = async (userId: string, status: string) => {
    try {
      await updateUserAdminFn({
        data: { userId, status: status as (typeof USER_STATUSES)[number] },
      })
      await queryClient.invalidateQueries({ queryKey: ['flamekeepers'] })
      await queryClient.invalidateQueries({ queryKey: ['users'] })
      toast.success('Status updated')
    } catch (error) {
      toast.error('Failed to update status', {
        description: errorMessage(error, 'An error occurred'),
      })
    }
  }

  const isFiltered =
    Boolean(filters.search) ||
    Boolean(filters.status) ||
    filters.attention === '1'

  const resetFilters = () => {
    navigate({
      to: '.',
      search: {
        search: undefined,
        status: undefined,
        attention: undefined,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      },
    })
  }

  const banRow = rows.find((row) => row.userId === banUserId)
  const unbanRow = rows.find((row) => row.userId === unbanUserId)

  return (
    <section aria-label="Flamekeepers" className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={filters.search ?? ''}
            onChange={(event) =>
              updateFilters({ search: event.target.value || undefined })
            }
            placeholder="Search name or email"
            aria-label="Search flamekeepers"
            className="h-9 pl-8"
          />
        </div>

        <Select
          value={filters.status ?? 'all'}
          onValueChange={(value) =>
            updateFilters({
              status:
                value === 'all'
                  ? undefined
                  : (value as (typeof USER_STATUSES)[number]),
            })
          }
        >
          <SelectTrigger
            size="sm"
            className="h-9"
            aria-label="Filter by status"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Any status</SelectItem>
            {USER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {status}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.attention === '1' ? 'secondary' : 'outline'}
          size="sm"
          className="h-9 gap-2"
          aria-pressed={filters.attention === '1'}
          onClick={() =>
            updateFilters({
              attention: filters.attention === '1' ? undefined : '1',
            })
          }
        >
          <span className="size-1.5 rounded-full bg-amber-500" />
          Needs attention
          <span className="tabular-nums text-muted-foreground">
            {attentionCount}
          </span>
        </Button>

        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            className="h-9"
            onClick={resetFilters}
          >
            Reset
          </Button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-muted-foreground sm:inline">
            {isFiltered
              ? `${visible.length} of ${rows.length}`
              : `${rows.length} ${rows.length === 1 ? 'person' : 'people'}`}
          </span>
          <Select
            value={`${filters.sortBy}:${filters.sortOrder}`}
            onValueChange={(value) => {
              const [sortBy, sortOrder] = value.split(':') as [
                FlamekeeperSortKey,
                'asc' | 'desc',
              ]
              updateFilters({ sortBy, sortOrder })
            }}
          >
            <SelectTrigger
              size="sm"
              className="h-9"
              aria-label="Sort flamekeepers"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLAMEKEEPER_SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {isLoading && visible.length === 0 ? (
        <div className="space-y-3 py-4" aria-hidden="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="size-9 rounded-full bg-muted" />
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="ml-auto h-3 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed px-4 py-8">
          <p className="text-sm text-muted-foreground">
            No flamekeepers match these filters.
          </p>
          {isFiltered && (
            <Button variant="outline" size="sm" onClick={resetFilters}>
              Clear filters
            </Button>
          )}
        </div>
      ) : (
        <ul className="divide-y border-y">
          {visible.map((row) => {
            const expanded = expandedId === row.userId
            const issues = flamekeeperIssues(row, now)
            const danger = issues.some(
              (issue) => issue.key === 'lost' || issue.key === 'banned'
            )

            return (
              <li
                key={row.userId}
                id={`flamekeeper-${row.userId}`}
                className={cn('transition-colors', expanded && 'bg-muted/40')}
              >
                <div className="flex items-center gap-3 px-1 py-3">
                  <StateDot state={row.state} />
                  <button
                    type="button"
                    onClick={() =>
                      onExpandedChange(expanded ? null : row.userId)
                    }
                    aria-expanded={expanded}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <UserAvatar
                      image={row.image}
                      name={row.name}
                      className="size-9 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-medium">
                          {row.name || 'No name'}
                        </span>
                        {row.bannedAt && (
                          <Badge variant="destructive">Banned</Badge>
                        )}
                        {!row.isMember && (
                          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                            Not a member
                          </span>
                        )}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {row.email}
                      </div>
                      {issues.length > 0 && (
                        <div
                          className={cn(
                            'mt-0.5 truncate text-xs',
                            danger
                              ? 'text-destructive'
                              : 'text-amber-700 dark:text-amber-400'
                          )}
                        >
                          {issues.map((issue) => issue.label).join(' · ')}
                        </div>
                      )}
                    </div>
                  </button>

                  <div className="hidden w-28 shrink-0 sm:block">
                    <StatusSelect row={row} onUpdate={handleUpdateStatus} />
                  </div>
                  <div className="hidden w-44 shrink-0 md:block">
                    <UsageMeter
                      used={row.usedBytes}
                      pledged={row.pledgedBytes}
                    />
                  </div>
                  <div className="hidden w-24 shrink-0 text-right text-xs text-muted-foreground lg:block">
                    {formatGraduationMonth(row.graduationDate) || '—'}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      onExpandedChange(expanded ? null : row.userId)
                    }
                    aria-expanded={expanded}
                    aria-label={`${expanded ? 'Hide' : 'Show'} details for ${row.name}`}
                    className="shrink-0 rounded-md p-1 text-muted-foreground outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ChevronDown
                      className={cn(
                        'size-4 transition-transform',
                        expanded && 'rotate-180'
                      )}
                    />
                  </button>
                </div>

                {expanded && (
                  <ExpandedFlamekeeper
                    row={row}
                    now={now}
                    canBan={canBan}
                    viewerId={viewerId}
                    onBan={() => setBanUserId(row.userId)}
                    onUnban={() => setUnbanUserId(row.userId)}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}

      {banRow && (
        <BanUserDialog
          userId={banRow.userId}
          userName={banRow.name}
          open
          onOpenChange={(open) => !open && setBanUserId(null)}
        />
      )}
      {unbanRow && (
        <UnbanUserDialog
          userId={unbanRow.userId}
          userName={unbanRow.name}
          open
          onOpenChange={(open) => !open && setUnbanUserId(null)}
        />
      )}
    </section>
  )
}
