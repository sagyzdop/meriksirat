import { useState } from 'react'
import { toast } from 'sonner'
import { useAsyncAction } from '@/hooks/use-async-action'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Table, TableBody } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
} from '@/components/admin/members/components/user-badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import { UserAlbumsTab, type AlbumSearch } from './components/user-albums-tab'
import type { AdminUserAlbum } from '@/lib/admin/dashboard-types'
import type { PaginationMeta } from '@/lib/pagination'
import { DetailRow } from '@/components/shared/detail-row'
import { fullName } from '@/lib/utils'

const formatDate = (value: string | number | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface PageProps {
  user: {
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
  albums: AdminUserAlbum[]
  albumsPagination: PaginationMeta
  albumsSearch: AlbumSearch
  albumsIsLoading?: boolean
  canBan?: boolean
  viewerId?: string
}

export function Page({
  user,
  albums,
  albumsPagination,
  albumsSearch,
  albumsIsLoading = false,
  canBan = false,
  viewerId,
}: PageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const goBack = useBackNavigation('/admin/members')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const { pending: isResetting, run } = useAsyncAction()
  const [showBanDialog, setShowBanDialog] = useState(false)
  const [tab, setTab] = useState('details')
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

  return (
    <PageContainer>
      <PageHeader
        title="Member Details"
        onBack={goBack}
        actions={
          canBan &&
          (user.bannedAt || user.id !== viewerId) && (
            <Button
              variant={user.bannedAt ? 'outline' : 'destructive'}
              onClick={() => setShowBanDialog(true)}
            >
              {user.bannedAt ? 'Unban member' : 'Ban member'}
            </Button>
          )
        }
      />
      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList variant="line">
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="albums">Albums</TabsTrigger>
          <TabsTrigger value="violations">Violations</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <DetailRow label="Name">
                  <div className="flex items-center gap-3">
                    <UserAvatar
                      image={user.image}
                      name={fullName(user) || user.email || 'Member'}
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
                <DetailRow label="Member ID" valueClassName="whitespace-nowrap">
                  {user.id}
                </DetailRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="albums">
          <UserAlbumsTab
            albums={albums}
            pagination={albumsPagination}
            search={albumsSearch}
            isLoading={albumsIsLoading}
          />
        </TabsContent>

        <TabsContent value="violations" className="space-y-4">
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

          <Button
            variant="outline"
            disabled={!hasViolations || isResetting}
            onClick={() => setShowResetDialog(true)}
          >
            Clear Violations
          </Button>
        </TabsContent>
      </Tabs>

      <AlertDialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Violations</AlertDialogTitle>
            <AlertDialogDescription>
              Reset this member's violation counters to zero? This will not
              affect any past or current bookings.
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
