import { useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ImageIcon } from 'lucide-react'
import { equipmentQueries } from '@/lib/equipment'
import { GoogleCalendarView } from '@/components/shared/event-calendar/google-calendar-view'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table'
import { useBackNavigation } from '@/hooks/use-back-navigation'

export function Page() {
  const { _splat: equipmentId } = useParams({ strict: false })
  const numericId = parseInt(equipmentId as string, 10)
  const hasValidId = !isNaN(numericId)
  const goBack = useBackNavigation('/equipment')
  const [imageFailed, setImageFailed] = useState(false)

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

  const showPlaceholder = imageFailed || !equipment.imagePath

  return (
    <PageContainer>
      <PageHeader title={equipment.modelName} onBack={goBack} />

      <div className="space-y-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
          <div className="relative aspect-square overflow-hidden rounded-lg border bg-muted">
            {showPlaceholder ? (
              <div className="flex h-full w-full items-center justify-center">
                <ImageIcon className="h-16 w-16 text-muted-foreground/50" />
              </div>
            ) : (
              <img
                src={`/api/images/${equipment.imagePath}`}
                alt={equipment.modelName}
                onError={() => setImageFailed(true)}
                className="absolute inset-0 h-full w-full object-cover"
              />
            )}
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
                      <TableCell>
                        <Badge variant="outline">
                          {equipment.category.name}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  )}
                  <TableRow>
                    <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                      Clearance Level
                    </TableCell>
                    <TableCell>
                      {equipment.requiredClearanceLevel ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-amber-700"
                        >
                          Level {equipment.requiredClearanceLevel}
                        </Badge>
                      ) : (
                        'None'
                      )}
                    </TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
                      Status
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          equipment.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-700'
                        }
                      >
                        {equipment.isActive ? 'Available' : 'Unavailable'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Section>
        </div>

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
