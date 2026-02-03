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
import { handleBookingAndCalendar } from "@/lib/booking"
import { getEquipmentByIdFn, type EquipmentWithCategory } from "@/lib/equipment"
import { toast } from "sonner"
import { Spinner } from "@/components/ui/spinner"
import { TimeSlotPicker, getBookingTimesFromSlots } from "@/components/shared/time-slot-picker"
import { format } from "date-fns"

export function NewBookingPage() {
  const router = useRouter()
  const searchParams = useSearch({ strict: false }) as { equipmentId?: number }
  
  // Equipment selection state
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentWithCategory | null>(null)
  const [isLoadingEquipment, setIsLoadingEquipment] = React.useState(false)
  
  // Booking state
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>()
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  const [isBooking, setIsBooking] = React.useState(false)

  // Load equipment if equipmentId is provided in URL
  React.useEffect(() => {
    if (searchParams.equipmentId) {
      loadEquipment(searchParams.equipmentId)
    }
  }, [searchParams.equipmentId])

  const loadEquipment = async (equipmentId: number) => {
    setIsLoadingEquipment(true)
    try {
      const equipment = await getEquipmentByIdFn({ data: { equipmentId } })
      if (equipment) {
        setSelectedEquipment(equipment)
      } else {
        toast.error("Equipment not found")
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
    if (!selectedEquipment) return
    
    const times = getBookingTimesFromSlots(selectedSlots, selectedDate)
    if (!times) return

    setIsBooking(true)
    try {
      const result = await handleBookingAndCalendar({
        data: {
          equipmentId: selectedEquipment.id,
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
      toast.error(error.message || "Failed to create booking")
    } finally {
      setIsBooking(false)
    }
  }

  const bookingTimes = getBookingTimesFromSlots(selectedSlots, selectedDate)

  if (isLoadingEquipment) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
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
          
          {selectedEquipment ? (
            <Link to={`/equipment/${selectedEquipment.id}`} className="block">
              <Card className="hover:shadow-lg transition-shadow cursor-pointer border-2 hover:border-primary/50">
                <CardContent className="p-6">
                  <div className="flex items-start gap-6">
                    <div className="relative flex-shrink-0">
                      {selectedEquipment.imagePath ? (
                        <img 
                          src={`/api/images/${selectedEquipment.imagePath}`} 
                          alt={selectedEquipment.modelName}
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
                          <h3 className="text-lg font-semibold mb-1">{selectedEquipment.modelName}</h3>
                          <p className="text-sm text-muted-foreground mb-2">
                            {selectedEquipment.category?.name}
                          </p>
                          {selectedEquipment.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {selectedEquipment.description}
                            </p>
                          )}
                        </div>
                        <ExternalLink className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
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

        {/* Equipment Calendar View */}
        {selectedEquipment && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Equipment Calendar</h2>
            <iframe
              src={`https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Asia%2FAlmaty&showPrint=0&mode=WEEK&showCalendars=0&showTz=0&src=${encodeURIComponent(selectedEquipment.googleCalendarId)}&color=%237986cb`}
              className="w-full h-[600px] border rounded-lg"
              style={{ borderWidth: 1 }}
              allowFullScreen
            ></iframe>
          </div>
        )}

        {/* Date & Time Selection */}
        {selectedEquipment && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Date & Time</h2>
            <TimeSlotPicker
              googleCalendarId={selectedEquipment.googleCalendarId}
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
                <p className="font-medium">{selectedEquipment?.modelName}</p>
                <p>{selectedEquipment?.category?.name}</p>
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
