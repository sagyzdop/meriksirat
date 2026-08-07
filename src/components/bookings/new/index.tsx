import * as React from "react"
import { Loader2, Trash2 } from "lucide-react"
import { useRouter, useSearch, Link } from "@tanstack/react-router"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { createBookingFn } from "@/lib/booking"
import { getEquipmentByIdFn, type EquipmentWithCategory } from "@/lib/equipment"
import { GoogleCalendarView } from "@/components/shared/event-calendar/google-calendar-view"
import type { EventColor } from "@/components/shared/event-calendar"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TimeSlotPicker, getBookingTimesFromSlots } from "@/components/shared/time-slot-picker"
import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Section } from "@/components/layout/section"
import { format } from "date-fns"

export function NewBookingPage() {
  const router = useRouter()
  const searchParams = useSearch({ strict: false }) as { equipmentId?: number; equipmentIds?: number[] }
  
  // Equipment selection state
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentWithCategory[]>([])
  const [isLoadingEquipment, setIsLoadingEquipment] = React.useState(false)
  
  // Booking state
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>()
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  const [isBooking, setIsBooking] = React.useState(false)

  // Load equipment if equipmentId is provided in URL
  const equipmentIds = React.useMemo(() => {
    if (searchParams.equipmentIds && searchParams.equipmentIds.length > 0) {
      return searchParams.equipmentIds
    }
    return searchParams.equipmentId ? [searchParams.equipmentId] : []
  }, [searchParams.equipmentId, searchParams.equipmentIds])

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
        equipmentIds.map((equipmentId) => getEquipmentByIdFn({ data: { equipmentId } }))
      )
      const validEquipment = equipmentList.filter((item): item is EquipmentWithCategory => Boolean(item))

      if (validEquipment.length === 0) {
        setSelectedEquipment([])
        toast.error("Equipment not found")
      } else {
        setSelectedEquipment(validEquipment)
      }
    } catch (error) {
      console.error("Failed to load equipment:", error)
      toast.error("Failed to load equipment")
    } finally {
      setIsLoadingEquipment(false)
    }
  }


  const handleSlotsChange = (slots: string[], date: Date | undefined) => {
    setSelectedSlots(slots)
    setSelectedDate(date)
  }

  const removeEquipment = (equipmentId: number) => {
    const remaining = selectedEquipment.filter((item) => item.id !== equipmentId)
    setSelectedEquipment(remaining)
    // Sync with the selection on /equipment (persisted in localStorage)
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
      toast.success(`Booking created successfully! Booking ID: #${result.bookingId}`)
      setIsDialogOpen(false)
      setSelectedSlots([])
      setNotes("")
      
      // Navigate to bookings list
      router.navigate({ to: '/bookings' })
    } catch (error: any) {
      console.error("Booking failed:", error)
      if (error?.conflicts && Array.isArray(error.conflicts)) {
        const conflictNames = error.conflicts
          .map((conflict: { equipmentId: number }) => equipmentNameById.get(conflict.equipmentId) || `Equipment ${conflict.equipmentId}`)
          .join(", ")
        toast.error(`Time slot unavailable for: ${conflictNames}`)
      } else {
        toast.error(error.message || "Failed to create booking")
      }
    } finally {
      setIsBooking(false)
    }
  }

  const bookingTimes = getBookingTimesFromSlots(selectedSlots, selectedDate)
  const equipmentNameById = React.useMemo(() => {
    return new Map(selectedEquipment.map((item) => [item.id, item.modelName]))
  }, [selectedEquipment])

  const equipmentColorMap = React.useMemo(() => {
    const palette: EventColor[] = ["sky", "amber", "violet", "rose", "emerald", "orange"]
    const map: Record<string, EventColor> = {}
    selectedEquipment.forEach((item, index) => {
      if (item.googleCalendarId) {
        map[item.googleCalendarId] = palette[index % palette.length]
      }
    })
    return map
  }, [selectedEquipment])

  const colorClasses: Record<EventColor, string> = {
    sky: "bg-sky-500",
    amber: "bg-amber-500",
    violet: "bg-violet-500",
    rose: "bg-rose-500",
    emerald: "bg-emerald-500",
    orange: "bg-orange-500",
  }

  const colorDotFor = (item: EquipmentWithCategory) =>
    colorClasses[equipmentColorMap[item.googleCalendarId] || "sky"]

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
        backTo="/equipment"
        backLabel="Back to Equipment"
      />

      <div className="space-y-8">
        {/* Selected Equipment Section */}
        <Section
          title="Selected Equipment"
          spacing="compact"
          actions={
            <Link to="/equipment">
              <Button variant="outline">Add More</Button>
            </Link>
          }
        >
          {selectedEquipment.length > 0 ? (
            <div className="relative rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Image</TableHead>
                    <TableHead className="whitespace-nowrap">Model Name</TableHead>
                    <TableHead className="whitespace-nowrap">Category</TableHead>
                    <TableHead className="whitespace-nowrap" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedEquipment.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="whitespace-nowrap">
                        <img
                          src={
                            item.imagePath
                              ? `/api/images/${item.imagePath}`
                              : "/equipment-placeholder.svg"
                          }
                          alt={item.modelName}
                          className="h-10 w-14 rounded-md border object-cover"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium">{item.modelName}</span>
                          {item.description && (
                            <span className="max-w-[280px] truncate text-sm text-muted-foreground">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline">
                          {item.category?.name ?? "Uncategorized"}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeEquipment(item.id)}
                          aria-label={`Remove ${item.modelName}`}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="relative rounded-md border py-12 text-center">
              <p className="text-muted-foreground">No equipment selected</p>
              <p className="text-sm text-muted-foreground mt-1">
                Please select equipment from the equipment page to continue
              </p>
            </div>
          )}
        </Section>

        {/* Availability View */}
        {selectedEquipment.length > 0 && (
          <Section title="Availability" spacing="compact">
            <GoogleCalendarView
              calendarIds={selectedEquipment
                .map((item) => item.googleCalendarId)
                .filter((id): id is string => Boolean(id))}
              colorByCalendarId={equipmentColorMap}
            />
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {selectedEquipment.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span className={`inline-flex size-2.5 rounded-full ${colorDotFor(item)}`} />
                  <span>{item.modelName}</span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Date & Time Selection */}
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

        {/* Book Equipment */}
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

      {/* Booking Confirmation Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Booking</DialogTitle>
            <DialogDescription>
              Please review your booking details and add any notes.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Equipment</Label>
              <div className="text-sm text-muted-foreground">
                {selectedEquipment.map((item) => (
                  <div key={item.id} className="flex items-center gap-2">
                    <span className={`inline-flex size-2.5 rounded-full ${colorDotFor(item)}`} />
                    <div>
                      <p className="font-medium">{item.modelName}</p>
                      <p>{item.category?.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Booking Details</Label>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium">Date:</span>{" "}
                  {selectedDate?.toLocaleDateString("en-US", {
                    weekday: "long",
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {bookingTimes && (
                  <>
                    <p>
                      <span className="font-medium">Start:</span>{" "}
                      {format(bookingTimes.startTime, "HH:mm")}
                    </p>
                    <p>
                      <span className="font-medium">End:</span>{" "}
                      {format(bookingTimes.endTime, "HH:mm")}
                    </p>
                    <p>
                      <span className="font-medium">Duration:</span>{" "}
                      {selectedSlots.length * 30} minutes
                    </p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                placeholder="Add any notes about your booking..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
              disabled={isBooking}
            >
              Cancel
            </Button>
            <Button onClick={handleBooking} disabled={isBooking}>
              {isBooking ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                "Confirm Booking"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageContainer>
  )
}
