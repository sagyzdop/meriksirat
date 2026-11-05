// PROTOTYPE: flamekeeper detail screen, copied from the existing user detail
// screen and extended with the flamekeeping rows.
import { useState } from 'react'
import { toast } from 'sonner'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { Table, TableBody } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import { resetUserViolationCountersFn } from '@/lib/user'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import {
  RoleBadge,
  StatusBadge,
} from '@/components/admin/users/components/user-badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import {
  UserAlbumsTable,
  type AlbumSearch,
} from '@/components/admin/users/$userId/components/user-albums-table'
import type { AdminUserAlbum } from '@/lib/admin/dashboard-types'
import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { PaginationMeta } from '@/lib/pagination'
import { DetailRow } from '@/components/shared/detail-row'
import { fullName } from '@/lib/utils'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { formatGraduationMonth } from '@/lib/graduation-date'
import { lostDeadline } from '@/lib/pool/health'
import { StateBadge } from '../components/state-badge'

const formatDate = (value: string | number | Date | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface FlamekeeperUser {
  id: string
  email: string
  image: string | null
  role: string | null
  clearanceLevel: number | null
  status: string | null
  firstName: string | null
  lastName: string | null
  instagramUsername: string | null
  nuId: number | null
  birthday: string | null
  major: string | null
  graduationYear: number | null
  onboardingComplete: boolean | null
  cancelledInStartWindowCount: number | null
  overdueCount: number | null
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
  updatedAt: Date
}

interface PageProps {
  user: FlamekeeperUser
  flamekeeper?: AdminFlamekeeperRow
  pool?: PoolOverview
  albums: AdminUserAlbum[]
  albumsPagination: PaginationMeta
  albumsSearch: AlbumSearch
  albumsIsLoading?: boolean
  canBan?: boolean
  viewerId?: string
}

export function Page({
  user,
  flamekeeper,
  pool,
  albums,
  albumsPagination,
  albumsSearch,
  albumsIsLoading = false,
  canBan = false,
  viewerId,
}: PageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const goBack = useBackNavigation('/admin/flamekeepers')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const { pending: isResetting, run } = useAsyncAction()
  const [showBanDialog, setShowBanDialog] = useState(false)
  const userName = fullName(user) || user.email

  const hasViolations =
    (user.cancelledInStartWindowCount ?? 0) > 0 || (user.overdueCount ?? 0) > 0

  const handleResetCounters = () =>
    run(async () => {
      await resetUserViolationCountersFn({ data: { userId: user.id } })
      toast.success('Violation counters reset')
      await queryClient.invalidateQueries()
      router.invalidate()
      setShowResetDialog(false)
    }, 'Failed to reset counters')

  const availableBytes = flamekeeper
    ? Math.max(0, flamekeeper.pledgedBytes - flamekeeper.usedBytes)
    : 0

  return (
    <PageContainer>
      <PageHeader title="Flamekeeper Details" onBack={goBack} />
      <div className="space-y-8">
        <Section spacing="compact">
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <DetailRow label="Name">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      image={user.image}
                      name={userName}
                      className="size-8"
                    />
                    <span>{fullName(user) || '—'}</span>
                  </div>
                </DetailRow>
                <DetailRow label="Email" valueClassName="break-all">
                  {user.email}
                </DetailRow>
                <DetailRow label="Role">
                  <RoleBadge role={user.role} />
                </DetailRow>
                <DetailRow label="Clearance Level">
                  {user.clearanceLevel ? (
                    <Badge
                      variant="outline"
                      className="font-mono text-amber-700"
                    >
                      Level {user.clearanceLevel}
                    </Badge>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="Status">
                  <StatusBadge status={user.status} />
                </DetailRow>
                <DetailRow label="Ban">
                  {user.bannedAt ? (
                    <div className="flex flex-col gap-1">
                      <Badge variant="destructive" className="w-fit">
                        Banned {formatDate(user.bannedAt.getTime())}
                      </Badge>
                      {user.banReason && (
                        <span className="text-sm text-muted-foreground">
                          {user.banReason}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Not banned</span>
                  )}
                </DetailRow>
                <DetailRow label="Instagram">
                  {user.instagramUsername ? (
                    <a
                      href={`https://instagram.com/${user.instagramUsername.replace(/^@/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline"
                    >
                      @{user.instagramUsername}
                    </a>
                  ) : (
                    '—'
                  )}
                </DetailRow>
                <DetailRow label="NU ID">{user.nuId ?? '—'}</DetailRow>
                <DetailRow label="Birthday">
                  {formatDate(user.birthday)}
                </DetailRow>
                <DetailRow label="Major">{user.major || '—'}</DetailRow>
                <DetailRow label="Graduation Year">
                  {user.graduationYear ?? '—'}
                </DetailRow>
                <DetailRow label="Member Since">
                  {formatDate(user.createdAt.getTime())}
                </DetailRow>
                <DetailRow label="User ID" valueClassName="whitespace-nowrap">
                  {user.id}
                </DetailRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section
          title="Flamekeeping"
          description="Pledge, usage, Drive connection and graduation."
          spacing="compact"
        >
          {flamekeeper ? (
            <div className="relative rounded-md border overflow-x-auto">
              <Table>
                <TableBody>
                  <DetailRow label="State">
                    <StateBadge state={flamekeeper.state} />
                  </DetailRow>
                  <DetailRow label="Pledged">
                    {formatGb(flamekeeper.pledgedBytes)}
                  </DetailRow>
                  <DetailRow label="Used">
                    {formatGb(flamekeeper.usedBytes)}
                  </DetailRow>
                  <DetailRow label="Available">
                    {formatGb(availableBytes)}
                  </DetailRow>
                  <DetailRow label="Drive usage">
                    {formatGb(flamekeeper.driveUsageBytes)}
                  </DetailRow>
                  <DetailRow label="Per-account cap">
                    {pool ? formatGb(pool.capBytes) : '—'}
                  </DetailRow>
                  <DetailRow label="Graduation">
                    {formatGraduationMonth(flamekeeper.graduationDate) || '—'}
                  </DetailRow>
                  <DetailRow label="Graduation confirmed">
                    {formatDate(flamekeeper.graduationConfirmedAt)}
                  </DetailRow>
                  <DetailRow label="Last health check">
                    {formatDate(flamekeeper.healthCheckedAt)}
                  </DetailRow>
                  <DetailRow label="Lost since">
                    {flamekeeper.lostSince ? (
                      <div className="flex flex-col gap-1">
                        <span>{formatDate(flamekeeper.lostSince)}</span>
                        <span className="text-sm text-muted-foreground">
                          Reconnect deadline:{' '}
                          {formatDate(lostDeadline(flamekeeper.lostSince))}
                        </span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">Not lost</span>
                    )}
                  </DetailRow>
                  <DetailRow label="Flamekeeper since">
                    {formatDate(flamekeeper.createdAt)}
                  </DetailRow>
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              This user has no flamekeeper record.
            </p>
          )}
        </Section>

        {canBan && (user.bannedAt || user.id !== viewerId) && (
          <Section
            title="Ban"
            description="Banning blocks sign-in, cancels upcoming bookings, removes album folder access and starts moving any photos they hold."
            spacing="compact"
          >
            <Button
              variant={user.bannedAt ? 'outline' : 'destructive'}
              onClick={() => setShowBanDialog(true)}
            >
              {user.bannedAt ? 'Unban user' : 'Ban user'}
            </Button>
          </Section>
        )}

        <Section
          title="Booking Violations"
          description="Counters incremented when the user's bookings are auto-cancelled for not starting, or returned late."
          spacing="compact"
        >
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <DetailRow label="Auto-cancelled bookings">
                  {user.cancelledInStartWindowCount ?? 0}
                </DetailRow>
                <DetailRow label="Overdue returns">
                  {user.overdueCount ?? 0}
                </DetailRow>
              </TableBody>
            </Table>
          </div>

          <div className="pt-4">
            <Button
              variant="outline"
              disabled={!hasViolations || isResetting}
              onClick={() => setShowResetDialog(true)}
            >
              Clear Violations
            </Button>
          </div>
        </Section>

        <Section
          title="Albums"
          description="Albums this user owns or co-authored."
          spacing="compact"
        >
          <UserAlbumsTable
            albums={albums}
            pagination={albumsPagination}
            filters={{
              search: albumsSearch.albumSearch,
              page: albumsSearch.albumPage,
              limit: albumsSearch.albumLimit,
              sortBy: albumsSearch.albumSortBy,
              sortOrder: albumsSearch.albumSortOrder,
            }}
            search={albumsSearch}
            isLoading={albumsIsLoading}
          />
        </Section>
      </div>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Violations</AlertDialogTitle>
            <AlertDialogDescription>
              Reset this user's violation counters to zero? This will not affect
              any past or current bookings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isResetting}>
              Keep Counters
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetCounters}
              disabled={isResetting}
            >
              {isResetting ? 'Clearing...' : 'Clear Violations'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {user.bannedAt ? (
        <UnbanUserDialog
          userId={user.id}
          userName={userName}
          open={showBanDialog}
          onOpenChange={setShowBanDialog}
        />
      ) : (
        <BanUserDialog
          userId={user.id}
          userName={userName}
          open={showBanDialog}
          onOpenChange={setShowBanDialog}
        />
      )}
    </PageContainer>
  )
}
