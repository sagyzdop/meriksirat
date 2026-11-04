import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  BanUserDialog,
  UnbanUserDialog,
} from '@/components/shared/ban-user-dialogs'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { UserTabs } from '@/components/admin/users/components/user-tabs'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { formatGb } from '@/lib/flamekeeper/rules'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'

interface PageProps {
  flamekeepers: AdminFlamekeeperRow[]
  search?: string
  isLoading?: boolean
  canBan?: boolean
  viewerId?: string
}

const STATE_VARIANT = {
  active: 'default',
  full: 'secondary',
  draining: 'outline',
  lost: 'destructive',
  drained: 'secondary',
} as const

export function Page({
  flamekeepers,
  search,
  isLoading = false,
  canBan = false,
  viewerId,
}: PageProps) {
  const navigate = useNavigate()
  const [banUserId, setBanUserId] = useState<string | null>(null)
  const [unbanUserId, setUnbanUserId] = useState<string | null>(null)
  const banRow = flamekeepers.find((row) => row.userId === banUserId)
  const unbanRow = flamekeepers.find((row) => row.userId === unbanUserId)

  return (
    <PageContainer>
      <PageHeader
        title="Manage Users"
        description={`${flamekeepers.length} flamekeeper${flamekeepers.length === 1 ? '' : 's'}`}
      />
      <UserTabs active="flamekeepers" />
      <div className="space-y-4">
        <Input
          placeholder="Search flamekeepers by name or email..."
          defaultValue={search ?? ''}
          className="max-w-sm"
          onChange={(e) =>
            navigate({
              to: '.',
              search: { search: e.target.value || undefined },
            })
          }
        />
        <div className={`rounded-md border ${isLoading ? 'opacity-60' : ''}`}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Pledged</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Graduation</TableHead>
                {canBan && <TableHead />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {flamekeepers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={canBan ? 6 : 5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No flamekeepers found.
                  </TableCell>
                </TableRow>
              ) : (
                flamekeepers.map((row) => (
                  <TableRow key={row.userId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <UserAvatar
                          image={row.image}
                          name={row.name}
                          className="size-8"
                        />
                        <div className="flex flex-col">
                          <span className="flex items-center gap-2 font-medium">
                            {row.name}
                            {row.isMember && (
                              <Badge variant="secondary">Member</Badge>
                            )}
                            {row.bannedAt && (
                              <Badge
                                variant="destructive"
                                title={row.banReason ?? undefined}
                              >
                                Banned
                              </Badge>
                            )}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {row.email}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[row.state]}>
                        {row.state}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatGb(row.pledgedBytes)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {formatGb(row.usedBytes)}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.graduationDate}
                    </TableCell>
                    {canBan && (
                      <TableCell className="text-right">
                        {row.bannedAt ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setUnbanUserId(row.userId)}
                          >
                            Unban
                          </Button>
                        ) : (
                          row.userId !== viewerId && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setBanUserId(row.userId)}
                            >
                              Ban
                            </Button>
                          )
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
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
    </PageContainer>
  )
}
