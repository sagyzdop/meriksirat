import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { updateBookingFn, cancelBookingFn } from '@/lib/booking'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { ArrowLeft, Save, Calendar, Package, AlertCircle, Clock, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { format } from 'date-fns'
import { Input } from '@/components/ui/input'

const editBookingSchema = z.object({
  startTime: z.string().min(1, 'Start time is required'),
  endTime: z.string().min(1, 'End time is required'),
  notes: z.string().optional(),
}).refine((data) => {
  const start = new Date(data.startTime)
  const end = new Date(data.endTime)
  return end > start
}, {
  message: 'End time must be after start time',
  path: ['endTime'],
})

type EditBookingForm = z.infer<typeof editBookingSchema>

interface PageProps {
  booking: any
  bookingId: number
}

export function Page({ booking, bookingId }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const form = useForm<EditBookingForm>({
    resolver: zodResolver(editBookingSchema),
    defaultValues: {
      startTime: format(new Date(booking.startTime), "yyyy-MM-dd'T'HH:mm"),
      endTime: format(new Date(booking.endTime), "yyyy-MM-dd'T'HH:mm"),
      notes: booking.userEventDetails || '',
    },
  })

  const onSubmit = async (data: EditBookingForm) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateBookingFn({
        data: {
          bookingId,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
          notes: data.notes,
        },
      })

      setSuccess('Booking updated successfully! Calendar has been synchronized.')
      
      setTimeout(() => {
        navigate({ to: '/bookings' })
      }, 1500)
    } catch (error) {
      console.error('Failed to update booking:', error)
      setError(error instanceof Error ? error.message : 'Failed to update booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    setError(null)
    setSuccess(null)

    try {
      await cancelBookingFn({
        data: { bookingId }
      })

      setSuccess('Booking cancelled successfully!')
      
      setTimeout(() => {
        navigate({ to: '/bookings' })
      }, 1500)
    } catch (error) {
      console.error('Failed to cancel booking:', error)
      setError(error instanceof Error ? error.message : 'Failed to cancel booking. Please try again.')
    } finally {
      setIsCancelling(false)
    }
  }

  const handleBack = () => {
    navigate({ to: '/bookings' })
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

  const canEdit = booking.status === 'booked' || booking.status === 'active'
  const canCancel = booking.status !== 'cancelled' && booking.status !== 'returned'

  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="flex items-center gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Button>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Edit Booking</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Update your booking details and schedule
            </p>
          </div>
        </div>
      </div>

      {!canEdit && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This booking cannot be edited because it has been {booking.status}. You can only edit bookings that are booked or active.
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
            Booking ID: #{booking.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
            {booking.equipment?.description && (
              <div className="text-sm text-muted-foreground pl-6">
                {booking.equipment.description}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Clock className="h-4 w-4" />
              Current Schedule
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
                <span className="font-medium">Status:</span>
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

          {booking.userEventDetails && (
            <div className="space-y-2">
              <div className="text-sm font-medium">Current Notes</div>
              <div className="text-sm text-muted-foreground bg-muted p-3 rounded-md whitespace-pre-wrap">
                {booking.userEventDetails}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Update Booking</CardTitle>
          <CardDescription>
            Modify your booking schedule and notes. Changes will be synchronized with Google Calendar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="startTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isSubmitting || !canEdit}
                        />
                      </FormControl>
                      <FormDescription>
                        When you plan to pick up the equipment
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time *</FormLabel>
                      <FormControl>
                        <Input
                          type="datetime-local"
                          {...field}
                          disabled={isSubmitting || !canEdit}
                        />
                      </FormControl>
                      <FormDescription>
                        When you plan to return the equipment
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notes</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Add any notes about your booking (optional)..."
                        className="min-h-[120px]"
                        {...field}
                        disabled={isSubmitting || !canEdit}
                      />
                    </FormControl>
                    <FormDescription>
                      Additional information about your booking
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Alert>
                <Calendar className="h-4 w-4" />
                <AlertDescription>
                  <strong>Calendar Synchronization:</strong> When you update this booking, the changes will be 
                  automatically synchronized with Google Calendar.
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

              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Button
                    type="submit"
                    disabled={isSubmitting || !canEdit}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleBack}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>
                </div>

                {canCancel && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        type="button"
                        variant="destructive"
                        disabled={isSubmitting || isCancelling}
                        className="flex items-center gap-2 w-full sm:w-auto"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to cancel this booking? This action cannot be undone.
                          The calendar event will be deleted.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel disabled={isCancelling}>No, keep it</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleCancel}
                          disabled={isCancelling}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {isCancelling ? 'Cancelling...' : 'Yes, cancel booking'}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
