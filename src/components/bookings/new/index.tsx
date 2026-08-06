import * as React from "react"
import { Loader2, ExternalLink } from "lucide-react"
import { useRouter, useSearch, Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { createBookingFn } from "@/lib/booking"
import { getEquipmentByIdFn, type EquipmentWithCategory } from "@/lib/equipment"
import { GoogleCalendarView } from "@/components/shared/event-calendar/google-calendar-view"
import type { EventColor } from "@/components/shared/event-calendar"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TimeSlotPicker, getBookingTimesFromSlots } from "@/components/shared/time-slot-picker"
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

  if (isLoadingEquipment) {
    return (
      <div className="flex items-center justify-center min-h-100">
        <Spinner className="h-8 w-8" />
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">New Booking</h1>
        </div>

        {/* Selected Equipment Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Selected Equipment</h2>
            <Link to="/equipment">
              <Button variant="outline" size="sm">
                Change Equipment
              </Button>
            </Link>
          </div>
          
          {selectedEquipment.length > 0 ? (
            <div className="grid gap-4">
              {selectedEquipment.map((item) => (
                <Link key={item.id} to="/equipment/$" params={{ _splat: item.id.toString() }} className="block">
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-6">
                        <div className="relative shrink-0">
                          {item.imagePath ? (
                            <img 
                              src={`/api/images/${item.imagePath}`} 
                              alt={item.modelName}
                              className="w-24 h-24 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                              <span className="text-muted-foreground text-xs">No image</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-2.5 w-2.5 rounded-full ${colorClasses[equipmentColorMap[item.googleCalendarId] || "sky"]}`}
                                />
                                <h3 className="text-lg font-semibold mb-1">
                                  {item.modelName}
                                </h3>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                {item.category?.name}
                              </p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground line-clamp-2">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No equipment selected</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Please select equipment from the equipment page to continue
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Availability View */}
        {selectedEquipment.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Availability</h2>
            <GoogleCalendarView
              calendarIds={selectedEquipment
                .map((item) => item.googleCalendarId)
                .filter((id): id is string => Boolean(id))}
              colorByCalendarId={equipmentColorMap}
            />
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              {selectedEquipment.map((item) => (
                <div key={item.id} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-2.5 w-2.5 rounded-full ${colorClasses[equipmentColorMap[item.googleCalendarId] || "sky"]}`}
                  />
                  <span>{item.modelName}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date & Time Selection */}
        {selectedEquipment.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Date & Time</h2>
            <TimeSlotPicker
              googleCalendarIds={selectedEquipment
                .map((item) => item.googleCalendarId)
                .filter((id): id is string => Boolean(id))}
              onSlotsChange={handleSlotsChange}
            />
            <div className="flex justify-end">
              <Button
                disabled={selectedSlots.length === 0}
                onClick={() => setIsDialogOpen(true)}
                className="w-full md:w-auto"
              >
                Book Equipment
              </Button>
            </div>
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
                    <span className={`inline-flex h-2.5 w-2.5 rounded-full ${colorClasses[equipmentColorMap[item.googleCalendarId] || "sky"]}`} />
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
    </div>
  )
}
