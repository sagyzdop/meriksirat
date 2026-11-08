import { useState } from 'react'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Table, TableBody } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import { StatusBadge } from '@/components/admin/members/components/user-badges'
import { UserAvatar } from '@/components/shared/user-avatar'
import type { PoolOverview } from '@/lib/admin/functions/pool'
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
  status: string | null
  firstName: string | null
  lastName: string | null
  instagramUsername: string | null
  nuId: number | null
  birthday: string | null
  major: string | null
  graduationYear: number | null
  bannedAt: Date | null
  banReason: string | null
  createdAt: Date
  updatedAt: Date
}

interface PageProps {
  user: FlamekeeperUser
  flamekeeper?: AdminFlamekeeperRow
  pool?: PoolOverview
  canBan?: boolean
  viewerId?: string
}

export function Page({
  user,
  flamekeeper,
  pool,
  canBan = false,
  viewerId,
}: PageProps) {
  const goBack = useBackNavigation('/admin/flamekeepers')
  const [showBanDialog, setShowBanDialog] = useState(false)
  const [tab, setTab] = useState('details')
  const userName = fullName(user) || user.email

  const availableBytes = flamekeeper
    ? Math.max(0, flamekeeper.pledgedBytes - flamekeeper.usedBytes)
    : 0

  return (
    <PageContainer>
      <PageHeader
        title="Flamekeeper Details"
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
          <TabsTrigger value="flamekeeping">Flamekeeping</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
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
                    <span className="flex items-center gap-2">
                      {fullName(user) || '—'}
                      {flamekeeper?.isMember && (
                        <Badge variant="secondary">Member</Badge>
                      )}
                    </span>
                  </div>
                </DetailRow>
                <DetailRow label="Email" valueClassName="break-all">
                  {user.email}
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
                <DetailRow label="Account since">
                  {formatDate(user.createdAt.getTime())}
                </DetailRow>
                <DetailRow label="User ID" valueClassName="whitespace-nowrap">
                  {user.id}
                </DetailRow>
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="flamekeeping">
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
        </TabsContent>
      </Tabs>

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
