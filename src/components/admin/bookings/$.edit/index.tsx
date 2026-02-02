import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { updateBookingStatusAdminFn } from '@/lib/booking'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Calendar, User, Package, AlertCircle, Clock } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { format } from 'date-fns'

const editBookingSchema = z.object({
  status: z.enum(['booked', 'active', 'returned', 'cancelled', 'overdue']),
  notes: z.string().optional(),
})

type EditBookingForm = z.infer<typeof editBookingSchema>

interface PageProps {
  booking: any
  bookingId: number
}

export function Page({ booking, bookingId }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const form = useForm<EditBookingForm>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      status: booking.status as 'booked' | 'active' | 'returned' | 'cancelled' | 'overdue',
      notes: '',
    },
  })

  const onSubmit = async (data: EditBookingForm) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateBookingStatusAdminFn({
        data: {
          bookingId,
          status: data.status,
          notes: data.notes,
        },
      })

      setSuccess('Booking updated successfully! Database and calendar have been synchronized.')
      
      setTimeout(() => {
        navigate({ to: '/admin/bookings' })
      }, 2000)
    } catch (error) {
      console.error('Failed to update booking:', error)
      setError(error instanceof Error ? error.message : 'Failed to update booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/admin/bookings' })
  }

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'active':
        return 'default'
      case 'booked':
        return 'secondary'
      case 'returned':
        return 'outline'
      case 'cancelled':
        return 'destructive'
      case 'overdue':
        return 'destructive'
      default:
        return 'secondary'
    }
  }

  const isOverdue = new Date(booking.endTime) < new Date() && 
    (booking.status === 'booked' || booking.status === 'active')

  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCancel}
            className="flex items-center gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Button>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Edit Booking</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Update booking status and add administrative notes
            </p>
          </div>
        </div>
      </div>

      {isOverdue && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This booking is overdue! The equipment was due on {format(new Date(booking.endTime), 'PPP p')}.
          </AlertDescription>
        </Alert>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Booking Information
          </CardTitle>
          <CardDescription>
            Booking ID: {booking.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" />
              User Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pl-6">
              <div>
                <span className="font-medium">Name:</span>
                <span className="ml-2 text-muted-foreground break-words">
                  {booking.user?.name || `${booking.user?.firstName || ''} ${booking.user?.lastName || ''}`.trim() || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="font-medium">Email:</span>
                <span className="ml-2 text-muted-foreground break-all">{booking.user?.email || 'Unknown'}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4" />
              Equipment Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pl-6">
              <div>
                <span className="font-medium">Model:</span>
                <span className="ml-2 text-muted-foreground">{booking.equipment?.modelName || 'Unknown'}</span>
              </div>
              <div>
                <span className="font-medium">Equipment ID:</span>
                <span className="ml-2 font-mono text-muted-foreground">{booking.equipmentId}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Booking Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm pl-6">
              <div>
                <span className="font-medium">Start Time:</span>
                <span className="ml-2 text-muted-foreground">
                  {format(new Date(booking.startTime), 'PPP p')}
                </span>
              </div>
              <div>
                <span className="font-medium">End Time:</span>
                <span className="ml-2 text-muted-foreground">
                  {format(new Date(booking.endTime), 'PPP p')}
                </span>
              </div>
              <div>
                <span className="font-medium">Current Status:</span>
                <Badge variant={getStatusBadgeVariant(booking.status)} className="ml-2">
                  {booking.status.toUpperCase()}
                </Badge>
              </div>
              <div>
                <span className="font-medium">Created:</span>
                <span className="ml-2 text-muted-foreground">
                  {format(new Date(booking.createdAt), 'PPP')}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              Calendar Integration
            </div>
            <div className="text-sm pl-6">
              <span className="font-medium">Google Calendar Event ID:</span>
              <span className="ml-2 font-mono text-xs text-muted-foreground break-all">
                {booking.googleCalendarEventId || 'Not synced'}
              </span>
            </div>
          </div>

          {booking.userEventDetails && (
            <div className="space-y-2">
              <div className="text-sm font-medium">User Notes & History</div>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">
                {booking.userEventDetails}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Booking Status</CardTitle>
          <CardDescription>
            Change the booking status and add administrative notes. Changes will be synchronized with Google Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Booking Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      disabled={isSubmitting}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="returned">Returned</SelectItem>
                        <SelectItem value="cancelled">Cancelled</SelectItem>
                        <SelectItem value="overdue">Overdue</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {field.value === 'cancelled' && 
                        'Cancelling will delete the Google Calendar event.'}
                      {field.value === 'returned' && 
                        'Mark as returned when equipment has been returned.'}
                      {field.value === 'overdue' && 
                        'Mark as overdue when equipment is not returned on time.'}
                      {field.value === 'active' && 
                        'Mark as active when equipment has been picked up.'}
                      {field.value === 'booked' && 
                        'Booked status indicates the booking is confirmed but equipment not yet picked up.'}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Administrative Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add administrative notes about this booking update (optional)..."
                        className="min-h-[120px]"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormDescription>
                      These notes will be appended to the booking history and visible to other admins.
                      Your email will be automatically included with the note.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  <strong>Calendar Synchronization:</strong> When you update this booking, the changes will be 
                  automatically synchronized with Google Calendar. The calendar event will be updated with the 
                  new status and your administrative notes.
                </AlertDescription>
              </Alert>

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
