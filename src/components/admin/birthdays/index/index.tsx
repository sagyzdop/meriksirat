import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BirthdayDataTable } from './components/birthday-data-table'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { syncBirthdaysToCalendarFn } from '@/lib/birthdays/functions/birthdays'
import type {
  BirthdayListFilters,
  BirthdayPagination,
  BirthdayUser,
} from '@/lib/birthdays/types'

interface PageProps {
  birthdays: BirthdayUser[]
  pagination: BirthdayPagination
  filters: BirthdayListFilters
  isLoading?: boolean
}

export function Page({
  birthdays,
  pagination,
  filters,
  isLoading = false,
}: PageProps) {
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

  const description =
    pagination.totalCount > 0
      ? `${pagination.totalCount} upcoming birthday${pagination.totalCount === 1 ? '' : 's'} in the next 30 days`
      : 'No birthdays found'

  return (
    <PageContainer>
      <PageHeader
        title="Birthdays"
        description={description}
        actions={
          <Button onClick={handleSync} disabled={isSyncing}>
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`}
            />
            {isSyncing ? 'Syncing...' : 'Sync to Calendar'}
          </Button>
        }
      />
      <BirthdayDataTable
        data={birthdays}
        pagination={pagination}
        filters={filters}
        isLoading={isLoading}
      />
    </PageContainer>
  )
}
