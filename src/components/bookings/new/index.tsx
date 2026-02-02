import * as React from "react"
import { addDays, format } from "date-fns"
import { CheckCircle, Loader2 } from "lucide-react"
import { useRouter, useSearch, Link } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
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
import { checkCalendarFreeBusy } from "@/lib/google/google-caledar"
import { handleBookingAndCalendar } from "@/lib/booking"
import { getEquipmentByIdFn, type EquipmentWithCategory } from "@/lib/equipment"
import { getBookingSettingsFn, minutesToTime } from "@/lib/booking"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { Spinner } from "@/components/ui/spinner"

interface TimeSlot {
  time: string
  available: boolean
}

export function NewBookingPage() {
  const router = useRouter()
  const searchParams = useSearch({ strict: false }) as { equipmentId?: number }
  
  // Equipment selection state
  const [selectedEquipment, setSelectedEquipment] = React.useState<EquipmentWithCategory | null>(null)
  const [isLoadingEquipment, setIsLoadingEquipment] = React.useState(false)
  
  // Settings state
  const [bookingSettings, setBookingSettings] = React.useState<{
    globalBookingNote: string
    operatingHoursStart: number
    operatingHoursEnd: number
  } | null>(null)
  
  // Booking state
  const [date, setDate] = React.useState<Date | undefined>(new Date())
  const [month, setMonth] = React.useState<Date>(new Date())
  const [selectedSlots, setSelectedSlots] = React.useState<string[]>([])
  const [timeSlots, setTimeSlots] = React.useState<TimeSlot[]>([])
  const [isLoadingSlots, setIsLoadingSlots] = React.useState(false)
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [notes, setNotes] = React.useState("")
  const [isBooking, setIsBooking] = React.useState(false)

  // Load settings on mount
  React.useEffect(() => {
    loadSettings()
  }, [])

  // Load equipment if equipmentId is provided in URL
  React.useEffect(() => {
    if (searchParams.equipmentId) {
      loadEquipment(searchParams.equipmentId)
    }
  }, [searchParams.equipmentId])

  const loadSettings = async () => {
    try {
      const settings = await getBookingSettingsFn()
      setBookingSettings(settings)
    } catch (error) {
      console.error("Failed to load settings:", error)
      toast.error("Failed to load booking settings")
    }
  }

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

  // Generate time slots based on operating hours (30-minute increments)
  const generateTimeSlots = (): string[] => {
    if (!bookingSettings) return []
    
    const slots: string[] = []
    const startMinutes = bookingSettings.operatingHoursStart
    const endMinutes = bookingSettings.operatingHoursEnd
    
    for (let minutes = startMinutes; minutes <= endMinutes; minutes += 30) {
      // Don't add slot if it would end after operating hours
      if (minutes + 30 > endMinutes) break
      slots.push(minutesToTime(minutes))
    }
    
    return slots
  }

  // Check availability for selected date
  const checkAvailability = React.useCallback(async (selectedDate: Date) => {
    if (!selectedDate || !selectedEquipment?.googleCalendarId || !bookingSettings) return

    setIsLoadingSlots(true)
    try {
      // Set time range based on operating hours
      const startOfDay = new Date(selectedDate)
      const startHour = Math.floor(bookingSettings.operatingHoursStart / 60)
      const startMinute = bookingSettings.operatingHoursStart % 60
      startOfDay.setHours(startHour, startMinute, 0, 0)
      
      const endOfDay = new Date(selectedDate)
      const endHour = Math.floor(bookingSettings.operatingHoursEnd / 60)
      const endMinute = bookingSettings.operatingHoursEnd % 60
      endOfDay.setHours(endHour, endMinute, 59, 999)

      const result = await checkCalendarFreeBusy({
        data: {
          calendarId: selectedEquipment.googleCalendarId,
          timeMin: startOfDay.toISOString(),
          timeMax: endOfDay.toISOString(),
        },
      })

      const busySlots = result.busy || []
      const allSlots = generateTimeSlots()

      // Check each slot against busy periods
      const slotsWithAvailability: TimeSlot[] = allSlots.map((time) => {
        const [hour, minute] = time.split(":").map(Number)
        const slotStart = new Date(selectedDate)
        slotStart.setHours(hour, minute, 0, 0)
        
        const slotEnd = new Date(slotStart)
        slotEnd.setMinutes(slotEnd.getMinutes() + 30)

        // Check if this slot overlaps with any busy period
        const isAvailable = !busySlots.some((busy: any) => {
          const busyStart = new Date(busy.start)
          const busyEnd = new Date(busy.end)
          return (
            (slotStart >= busyStart && slotStart < busyEnd) ||
            (slotEnd > busyStart && slotEnd <= busyEnd) ||
            (slotStart <= busyStart && slotEnd >= busyEnd)
          )
        })

        return { time, available: isAvailable }
      })

      setTimeSlots(slotsWithAvailability)
    } catch (error) {
      console.error("Failed to check availability:", error)
      toast.error("Failed to load availability")
    } finally {
      setIsLoadingSlots(false)
    }
  }, [selectedEquipment?.googleCalendarId, bookingSettings])

  // Load availability when date, equipment, or settings change
  React.useEffect(() => {
    if (date && selectedEquipment && bookingSettings) {
      setSelectedSlots([])
      checkAvailability(date)
    }
  }, [date, selectedEquipment, bookingSettings, checkAvailability])

  // Handle time slot selection (allow multiple consecutive slots)
  const handleSlotClick = (time: string) => {
    const slot = timeSlots.find((s) => s.time === time)
    if (!slot?.available) return

    setSelectedSlots((prev) => {
      if (prev.includes(time)) {
        return prev.filter((t) => t !== time)
      } else {
        return [...prev, time].sort()
      }
    })
  }

  // Calculate start and end times from selected slots
  const getBookingTimes = () => {
    if (selectedSlots.length === 0 || !date) return null

    const sortedSlots = [...selectedSlots].sort()
    const firstSlot = sortedSlots[0]
    const lastSlot = sortedSlots[sortedSlots.length - 1]

    const [startHour, startMinute] = firstSlot.split(":").map(Number)
    const [endHour, endMinute] = lastSlot.split(":").map(Number)

    const startTime = new Date(date)
    startTime.setHours(startHour, startMinute, 0, 0)

    const endTime = new Date(date)
    endTime.setHours(endHour, endMinute + 30, 0, 0)

    return { startTime, endTime }
  }

  const handleBooking = async () => {
    if (!selectedEquipment) return
    
    const times = getBookingTimes()
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

  const bookingTimes = getBookingTimes()

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
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  {selectedEquipment.imagePath && (
                    <img 
                      src={`/api/images/${selectedEquipment.imagePath}`} 
                      alt={selectedEquipment.modelName}
                      className="w-16 h-16 object-cover rounded-lg"
                    />
                  )}
                  <div>
                    <h3 className="font-semibold">{selectedEquipment.modelName}</h3>
                    <p className="text-sm text-muted-foreground">
                      {selectedEquipment.category?.name}
                    </p>
                    {selectedEquipment.description && (
                      <p className="text-sm mt-1">{selectedEquipment.description}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
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
            <Card>
              <CardContent className="pt-6">
                <iframe
                  src={`https://calendar.google.com/calendar/embed?height=600&wkst=1&ctz=Asia%2FAlmaty&showPrint=0&mode=WEEK&showCalendars=0&showTz=0&src=Y182YWZiN2RkOGI0ZDQzNmEwODlkNmQxNjQ5NWE2ZmYwZGQ1MmNhODVlNGNjMzU5MTg1ZWZjNDc2ODJjZDQ5YTJiQGdyb3VwLmNhbGVuZGFyLmdvb2dsZS5jb20&color=%237986cb`}
                  className="w-full h-[600px] border rounded-lg"
                  style={{ borderWidth: 1 }}
                  allowFullScreen
                ></iframe>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Date & Time Selection */}
        {selectedEquipment && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Select Date & Time</h2>
            <Card className="gap-0 p-0">
              <CardContent className="relative p-0 md:pr-64">
                <div className="p-6 flex flex-col items-center gap-4">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    month={month}
                    onMonthChange={setMonth}
                    disabled={(date) => {
                      const today = new Date()
                      today.setHours(0, 0, 0, 0)
                      return date < today
                    }}
                    showOutsideDays={false}
                    className="bg-transparent p-0 [--cell-size:--spacing(10)] md:[--cell-size:--spacing(12)]"
                    formatters={{
                      formatWeekdayName: (date) => {
                        return date.toLocaleString("en-US", { weekday: "short" })
                      },
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const today = new Date()
                        setDate(today)
                        setMonth(today)
                      }}
                    >
                      Today
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const tomorrow = addDays(new Date(), 1)
                        setDate(tomorrow)
                        setMonth(tomorrow)
                      }}
                    >
                      Tomorrow
                    </Button>
                  </div>
                </div>
                <div className="no-scrollbar inset-y-0 right-0 flex max-h-72 w-full scroll-pb-6 flex-col gap-4 overflow-y-auto border-t p-6 md:absolute md:max-h-none md:w-64 md:border-t-0 md:border-l">
                  <div className="text-sm font-medium text-gray-700 mb-2">
                    Available Times
                    {bookingSettings && (
                      <div className="text-xs font-normal text-muted-foreground mt-1">
                        Operating hours: {minutesToTime(bookingSettings.operatingHoursStart)} - {minutesToTime(bookingSettings.operatingHoursEnd)}
                      </div>
                    )}
                  </div>
                  {isLoadingSlots ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                    </div>
                  ) : (
                    <div className="grid gap-1">
                      {timeSlots.map((slot) => (
                        <Button
                          key={slot.time}
                          variant={selectedSlots.includes(slot.time) ? "default" : "outline"}
                          onClick={() => handleSlotClick(slot.time)}
                          disabled={!slot.available}
                          className={cn(
                            "w-full shadow-none text-xs h-8",
                            !slot.available && "opacity-40 cursor-not-allowed"
                          )}
                          size="sm"
                        >
                          {slot.time}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4 border-t px-6 !py-5 md:flex-row">
                <div className="text-sm flex-1">
                  {bookingTimes ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span>
                        Booking for{" "}
                        <span className="font-medium">
                          {date?.toLocaleDateString("en-US", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                          })}
                        </span>
                        {" "}from <span className="font-medium">{format(bookingTimes.startTime, "HH:mm")}</span>
                        {" "}to <span className="font-medium">{format(bookingTimes.endTime, "HH:mm")}</span>
                        {" "}({selectedSlots.length} slots)
                      </span>
                    </div>
                  ) : (
                    <span className="text-gray-500">
                      Select one or more consecutive time slots to book this equipment.
                    </span>
                  )}
                </div>
                <Button
                  disabled={selectedSlots.length === 0}
                  onClick={() => setIsDialogOpen(true)}
                  className="w-full md:ml-auto md:w-auto"
                >
                  Book Equipment
                </Button>
              </CardFooter>
            </Card>
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
                  {date?.toLocaleDateString("en-US", {
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
              {bookingSettings?.globalBookingNote && (
                <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md mb-2">
                  <p className="font-medium mb-1">Important:</p>
                  <p>{bookingSettings.globalBookingNote}</p>
                </div>
              )}
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