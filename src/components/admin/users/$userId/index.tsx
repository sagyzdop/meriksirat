import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
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
import { resetUserViolationCountersFn } from '@/lib/user'
import { useBackNavigation } from '@/hooks/use-back-navigation'

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

const formatRole = (role: string | null | undefined) => {
  if (!role) return '—'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

interface PageProps {
  user: any
}

export function Page({ user }: PageProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const goBack = useBackNavigation('/admin/users')
  const [showResetDialog, setShowResetDialog] = useState(false)
  const [isResetting, setIsResetting] = useState(false)

  const hasViolations =
    (user.cancelledInStartWindowCount ?? 0) > 0 || (user.overdueCount ?? 0) > 0

  const handleResetCounters = async () => {
    setIsResetting(true)
    try {
      await resetUserViolationCountersFn({ data: { userId: user.id } })
      toast.success('Violation counters reset')
      await queryClient.invalidateQueries()
      router.invalidate()
      setShowResetDialog(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to reset counters'
      )
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader title="User Details" onBack={goBack} />
      <div className="space-y-8">
        <Section spacing="compact">
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Name
                  </TableCell>
                  <TableCell>
                    {`${user.firstName || ''} ${user.lastName || ''}`.trim() ||
                      '—'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Email
                  </TableCell>
                  <TableCell className="break-all">{user.email}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Role
                  </TableCell>
                  <TableCell>{formatRole(user.role)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Clearance Level
                  </TableCell>
                  <TableCell>
                    {user.clearanceLevel ? `Level ${user.clearanceLevel}` : '—'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Status
                  </TableCell>
                  <TableCell>{user.status || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Instagram
                  </TableCell>
                  <TableCell>{user.instagramUsername || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    NU ID
                  </TableCell>
                  <TableCell>{user.nuId ?? '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Birthday
                  </TableCell>
                  <TableCell>{formatDate(user.birthday)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Major
                  </TableCell>
                  <TableCell>{user.major || '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Graduation Year
                  </TableCell>
                  <TableCell>{user.graduationYear ?? '—'}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Member Since
                  </TableCell>
                  <TableCell>{formatDate(user.createdAt)}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    User ID
                  </TableCell>
                  <TableCell className="whitespace-nowrap">{user.id}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section
          title="Booking Violations"
          description="Counters incremented when the user's bookings are auto-cancelled for not starting, or returned late."
          spacing="compact"
        >
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Auto-cancelled bookings
                  </TableCell>
                  <TableCell>{user.cancelledInStartWindowCount ?? 0}</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Overdue returns
                  </TableCell>
                  <TableCell>{user.overdueCount ?? 0}</TableCell>
                </TableRow>
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
    </PageContainer>
  )
}
