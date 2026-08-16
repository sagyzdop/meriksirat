import { useState } from 'react'
import { useRouter, Link } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Cake, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { syncBirthdaysToCalendarFn } from '@/lib/birthdays/functions/birthdays'
import type { BirthdayUser } from '@/lib/birthdays/types'

interface PageProps {
  birthdays: BirthdayUser[]
}

function formatOccurrence(occurrence: string): string {
  return new Date(`${occurrence}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function Page({ birthdays }: PageProps) {
  const router = useRouter()
  const [isSyncing, setIsSyncing] = useState(false)

  const handleSync = async () => {
    setIsSyncing(true)
    try {
      const result = await syncBirthdaysToCalendarFn()
      toast.success(
        `Calendar synced: ${result.created} created, ${result.updated} updated, ${result.deleted} deleted`
      )
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to sync birthdays to the calendar'
      )
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Birthdays"
        description={`${birthdays.length} upcoming birthday${
          birthdays.length === 1 ? '' : 's'
        } in the next 30 days`}
        actions={
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
            />
            {isSyncing ? 'Syncing...' : 'Sync to Calendar'}
          </Button>
        }
      />

      {birthdays.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Cake />
            </EmptyMedia>
            <EmptyTitle>No upcoming birthdays</EmptyTitle>
            <EmptyDescription>
              No Active or Board members have a birthday in the next 30 days.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Birthday</TableHead>
              <TableHead>Age</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {birthdays.map((birthday) => (
              <TableRow key={birthday.id}>
                <TableCell>
                  <Link
                    to="/admin/users/$userId"
                    params={{ userId: birthday.id }}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {[birthday.firstName, birthday.lastName]
                      .filter(Boolean)
                      .join(' ') || birthday.email}
                  </Link>
                  <div className="text-muted-foreground text-xs">
                    {birthday.email}
                  </div>
                </TableCell>
                <TableCell>{formatOccurrence(birthday.occurrence)}</TableCell>
                <TableCell>
                  {birthday.turningAge !== null
                    ? `Turning ${birthday.turningAge}`
                    : '—'}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{birthday.status}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </PageContainer>
  )
}
