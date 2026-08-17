import * as React from 'react'
import { useRouter, useNavigate, useSearch } from '@tanstack/react-router'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { createBookingFn } from '@/lib/booking'
import { getEquipmentByIdFn, type EquipmentWithCategory } from '@/lib/equipment'
import { GoogleCalendarView } from '@/components/shared/event-calendar/google-calendar-view'
import type { EventColor } from '@/components/shared/event-calendar'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import {
  TimeSlotPicker,
  getBookingTimesFromSlots,
} from '@/components/shared/time-slot-picker'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { EquipmentTable } from '@/components/shared/equipment-table'
import { AddEquipmentButton } from '@/components/shared/add-equipment-button'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import { BookingConfirmationDialog } from '@/components/bookings/new/components/booking-confirmation-dialog'

export function NewBookingPage() {
  const router = useRouter()
  const navigate = useNavigate()
  const goBack = useBackNavigation('/equipment')
  const searchParams = useSearch({ strict: false }) as {
    equipmentId?: number
    equipmentIds?: number[]
  }

  const [selectedEquipment, setSelectedEquipment] = React.useState<
    EquipmentWithCategory[]
  >([])
  const [isLoadingEquipment, setIsLoadingEquipment] = React.useState(false)

  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>()
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [notes, setNotes] = React.useState('')
  const [isBooking, setIsBooking] = React.useState(false)

  const equipmentIds = React.useMemo(() => {
    if (searchParams.equipmentIds && searchParams.equipmentIds.length > 0) {
      return searchParams.equipmentIds
    }
    return searchParams.equipmentId ? [searchParams.equipmentId] : []
  }, [searchParams.equipmentId, searchParams.equipmentIds])

  const equipmentNameById = React.useMemo(
    () => new Map(selectedEquipment.map((item) => [item.id, item.modelName])),
    [selectedEquipment]
  )

  const equipmentColorMap = React.useMemo(() => {
    const palette: EventColor[] = [
      'sky',
      'amber',
      'violet',
      'rose',
      'emerald',
      'orange',
    ]
    const map: Record<string, EventColor> = {}
    selectedEquipment.forEach((item, index) => {
      if (item.googleCalendarId) {
        map[item.googleCalendarId] = palette[index % palette.length]
      }
    })
    return map
  }, [selectedEquipment])

  const colorClasses: Record<EventColor, string> = {
    sky: 'bg-sky-500',
    amber: 'bg-amber-500',
    violet: 'bg-violet-500',
    rose: 'bg-rose-500',
    emerald: 'bg-emerald-500',
    orange: 'bg-orange-500',
  }

  const colorDotFor = (item: EquipmentWithCategory) =>
    colorClasses[equipmentColorMap[item.googleCalendarId] || 'sky']

  React.useEffect(() => {
    if (equipmentIds.length > 0) {
      loadEquipment(equipmentIds)
    } else {
      setSelectedEquipment([])
    }
  }, [equipmentIds])

  const loadEquipment = async (equipmentIds: number[]) => {
    setIsLoadingEquipment(true)
    try {
      const equipmentList = await Promise.all(
        equipmentIds.map((equipmentId) =>
          getEquipmentByIdFn({ data: { equipmentId } })
        )
      )
      const validEquipment = equipmentList.filter(
        (item): item is EquipmentWithCategory => Boolean(item)
      )

      if (validEquipment.length === 0) {
        setSelectedEquipment([])
        toast.error('Equipment not found')
      } else {
        setSelectedEquipment(validEquipment)
      }
    } catch (error) {
      console.error('Failed to load equipment:', error)
      toast.error('Failed to load equipment')
    } finally {
      setIsLoadingEquipment(false)
    }
  }

  const handleSlotsChange = (slots: string[], date: Date | undefined) => {
    setSelectedSlots(slots)
    setSelectedDate(date)
  }

  const removeEquipment = (equipmentId: number) => {
    const remaining = selectedEquipment.filter(
      (item) => item.id !== equipmentId
    )
    setSelectedEquipment(remaining)
    try {
      window.localStorage.setItem(
        'equipment-selection',
        JSON.stringify(remaining.map((item) => item.id))
      )
    } catch {
      // ignore storage errors
    }
    if (remaining.length === 0) {
      router.navigate({ to: '/equipment' })
    }
  }

  const rows = selectedEquipment.map((item) => ({
    key: item.id.toString(),
    equipmentId: item.id,
    title: item.modelName,
    imagePath: item.imagePath,
    categoryName: item.category?.name,
    action: (
      <Button
        variant="destructive"
        size="sm"
        onClick={() => removeEquipment(item.id)}
      >
        <Trash2 className="mr-1.5 h-3.5 w-3.5" />
        Remove
      </Button>
    ),
  }))

  const handleBooking = async () => {
    if (selectedEquipment.length === 0) return

    const times = getBookingTimesFromSlots(selectedSlots, selectedDate)
    if (!times) return

    setIsBooking(true)
    try {
      const result = await createBookingFn({
        data: {
          equipmentIds: selectedEquipment.map((item) => item.id),
          startTime: times.startTime.toISOString(),
          endTime: times.endTime.toISOString(),
          notes: notes || undefined,
        },
      })
      toast.success(
        `Booking created successfully! Booking ID: #${result.bookingId}`
      )
      setIsDialogOpen(false)
      setSelectedSlots([])
      setNotes('')
      setSelectedEquipment([])
      try {
        window.localStorage.setItem('equipment-selection', JSON.stringify([]))
      } catch {
        // ignore storage errors
      }
      navigate({
        to: '/bookings/$bookingId',
        params: { bookingId: result.bookingId.toString() },
      })
    } catch (error: unknown) {
      console.error('Booking failed:', error)
      const err = error as
        { conflicts?: Array<{ equipmentId: number }> } | undefined
      if (err?.conflicts && Array.isArray(err.conflicts)) {
        const conflictNames = err.conflicts
          .map(
            (conflict: { equipmentId: number }) =>
              equipmentNameById.get(conflict.equipmentId) ||
              `Equipment ${conflict.equipmentId}`
          )
          .join(', ')
        toast.error(`Time slot unavailable for: ${conflictNames}`)
      } else {
        toast.error(
          error instanceof Error ? error.message : 'Failed to create booking'
        )
      }
    } finally {
      setIsBooking(false)
    }
  }

  const bookingTimes = getBookingTimesFromSlots(selectedSlots, selectedDate)

  if (isLoadingEquipment) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <PageContainer>
      <PageHeader
        title="New Booking"
        description="Select equipment and choose a time slot for your booking"
        onBack={goBack}
      />

      <div className="space-y-8">
        <Section
          title="Selected Equipment"
          spacing="compact"
          actions={<AddEquipmentButton />}
        >
          <EquipmentTable
            rows={rows}
            emptyMessage="No equipment selected"
            emptyDescription="Select equipment from the equipment page to continue"
            emptyAction={<AddEquipmentButton />}
          />
        </Section>

        {selectedEquipment.length > 0 && (
          <Section title="Availability" spacing="compact">
            <GoogleCalendarView
              calendarIds={selectedEquipment
                .map((item) => item.googleCalendarId)
                .filter((id): id is string => Boolean(id))}
              colorByCalendarId={equipmentColorMap}
              legendLabels={Object.fromEntries(
                selectedEquipment
                  .filter((item) => item.googleCalendarId)
                  .map((item) => [item.googleCalendarId, item.modelName])
              )}
            />
          </Section>
        )}

        {selectedEquipment.length > 0 && (
          <Section title="Select Date & Time" spacing="compact">
            <TimeSlotPicker
              googleCalendarIds={selectedEquipment
                .map((item) => item.googleCalendarId)
                .filter((id): id is string => Boolean(id))}
              onSlotsChange={handleSlotsChange}
            />
          </Section>
        )}

        {selectedEquipment.length > 0 && (
          <div className="flex justify-end">
            <Button
              disabled={selectedSlots.length === 0}
              onClick={() => setIsDialogOpen(true)}
              className="w-full md:w-auto"
            >
              Book Equipment
            </Button>
          </div>
        )}
      </div>

      <BookingConfirmationDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        equipment={selectedEquipment}
        colorDotFor={colorDotFor}
        selectedDate={selectedDate}
        bookingTimes={bookingTimes}
        durationMinutes={selectedSlots.length * 30}
        notes={notes}
        onNotesChange={setNotes}
        onConfirm={handleBooking}
        isSubmitting={isBooking}
      />
    </PageContainer>
  )
}
