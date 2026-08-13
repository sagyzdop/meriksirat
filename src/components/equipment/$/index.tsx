import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { equipmentQueries } from '@/lib/equipment'
import { GoogleCalendarView } from '@/components/shared/event-calendar/google-calendar-view'
import { Spinner } from '@/components/ui/spinner'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'

export function Page() {
  const { _splat: equipmentId } = useParams({ strict: false })
  const numericId = parseInt(equipmentId as string, 10)
  const hasValidId = !isNaN(numericId)

  const {
    data: equipment,
    isPending,
    isError,
  } = useQuery({
    ...equipmentQueries.detail(numericId),
    enabled: hasValidId,
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  if (isError || !equipment || !hasValidId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center px-4">
          <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">
            Equipment not found
          </h2>
          <p className="text-gray-600 mt-2 text-sm sm:text-base">
            {!hasValidId
              ? 'Invalid equipment ID'
              : "The equipment you're looking for doesn't exist or you don't have access to it."}
          </p>
        </div>
      </div>
    )
  }

  return (
    <PageContainer>
      <PageHeader title={equipment.modelName} onBack={() => history.back()} />

      <div className="space-y-8">
        <div className="relative">
          <img
            src={
              equipment.imagePath
                ? `/api/images/${equipment.imagePath}`
                : '/equipment-placeholder.svg'
            }
            alt={equipment.modelName}
            className="w-full rounded-lg border object-cover aspect-video max-h-64"
          />
        </div>

        <Section title="Details" spacing="compact">
          <div className="relative rounded-md border overflow-x-auto">
            <Table>
              <TableBody>
                {equipment.description && (
                  <TableRow>
                    <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                      Description
                    </TableCell>
                    <TableCell className="whitespace-normal break-words">
                      {equipment.description}
                    </TableCell>
                  </TableRow>
                )}
                {equipment.category && (
                  <TableRow>
                    <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                      Category
                    </TableCell>
                    <TableCell>{equipment.category.name}</TableCell>
                  </TableRow>
                )}
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Required Clearance Level
                  </TableCell>
                  <TableCell>
                    {equipment.requiredClearanceLevel ?? 'None'}
                  </TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                    Status
                  </TableCell>
                  <TableCell>
                    {equipment.isActive ? 'Available' : 'Unavailable'}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </Section>

        <Section title="Availability" spacing="compact">
          <GoogleCalendarView
            calendarId={equipment.googleCalendarId}
            legendLabels={{
              [equipment.googleCalendarId]: equipment.modelName,
            }}
          />
        </Section>
      </div>
    </PageContainer>
  )
}
