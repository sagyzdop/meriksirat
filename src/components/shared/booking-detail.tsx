import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { PackageCheck, Pencil } from 'lucide-react'
import { createTelegramBotLink } from '@/lib/telegram/client-utils'

import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { EquipmentTable } from './equipment-table'
import { BookingItemAction } from './booking-item-action'
import { CancelBookingItemDialog } from './cancel-booking-item-dialog'
import { AddEquipmentButton } from './add-equipment-button'
import { BookingInfoTable } from './booking-info-table'
import type { BookingInfoTableBookedBy } from './booking-info-table'
import { ExtendBookingButton } from './extend-booking-button'
import type {
  BookingItemWithEquipment,
  BookingWithItems,
} from '@/lib/booking/types'

interface BookingDetailProps {
  booking: BookingWithItems
  onBack?: () => void
  editTo: string
  editLabel?: string
  bookedBy?: BookingInfoTableBookedBy | null
  cancelDescription?: string
  canCancel?: boolean
  onCancel?: () => Promise<unknown>
  canStart?: boolean
  onStart?: () => Promise<unknown>
  canReturn?: boolean
  canAddEquipment?: boolean
  returnTo?: string
  telegramBotUsername?: string
}

/**
 * BookingDetail renders a shared layout for viewing a single booking,
 * used by both the user and admin booking detail pages. Pass bookedBy to
 * show the "Booked by" row with a profile picture (admin context).
 */
export function BookingDetail({
  booking,
  onBack,
  editTo,
  editLabel = 'Edit Booking',
  bookedBy,
  cancelDescription = 'Are you sure you want to cancel this booking? This action cannot be undone and the calendar event will be removed.',
  canCancel = false,
  onCancel,
  canStart = false,
  onStart,
  canReturn = false,
  canAddEquipment = false,
  returnTo,
  telegramBotUsername,
}: BookingDetailProps) {
  const queryClient = useQueryClient()
  const router = useRouter()
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [isStarting, setIsStarting] = useState(false)
  const [pendingCancelItem, setPendingCancelItem] =
    useState<BookingItemWithEquipment | null>(null)

  const editable = booking.status === 'booked'

  const handleStart = async () => {
    if (!onStart) return
    setIsStarting(true)
    try {
      await onStart()
      toast.success('Booking started successfully')
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.invalidate()
      setShowStartDialog(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to start booking'
      )
    } finally {
      setIsStarting(false)
    }
  }

  const handleCancel = async () => {
    if (!onCancel) return
    setIsCancelling(true)
    try {
      await onCancel()
      toast.success('Booking cancelled successfully')
      await queryClient.invalidateQueries({ queryKey: ['bookings'] })
      router.invalidate()
      setShowCancelDialog(false)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to cancel booking'
      )
    } finally {
      setIsCancelling(false)
    }
  }

  const handleItemCancelled = async () => {
    await queryClient.invalidateQueries({ queryKey: ['bookings'] })
    router.invalidate()
  }

  const rows = booking.items.map((item) => ({
    key: item.id.toString(),
    equipmentId: item.equipmentId,
    title: item.equipment?.modelName ?? `Equipment ${item.equipmentId}`,
    imagePath: item.equipment?.imagePath,
    categoryName: item.equipment?.category?.name,
    action: (
      <BookingItemAction
        item={item}
        bookingStatus={booking.status}
        telegramBotUsername={telegramBotUsername}
        onCancelItem={editable ? setPendingCancelItem : undefined}
      />
    ),
  }))

  return (
    <PageContainer>
      <PageHeader title={`Booking #${booking.id}`} onBack={onBack} />

      <div className="space-y-8">
        <Section title="Details" spacing="compact">
          <BookingInfoTable booking={booking} bookedBy={bookedBy} />
        </Section>

        <Section
          title="Equipment"
          spacing="compact"
          actions={
            canAddEquipment && editable ? (
              <AddEquipmentButton bookingId={booking.id} returnTo={returnTo} />
            ) : undefined
          }
        >
          <EquipmentTable
            rows={rows}
            emptyMessage="Equipment details not available"
            emptyAction={
              canAddEquipment && editable ? (
                <AddEquipmentButton
                  bookingId={booking.id}
                  returnTo={returnTo}
                />
              ) : undefined
            }
          />
        </Section>

        <Section title="Notes" spacing="compact">
          {booking.userEventDetails ? (
            <div className="border-l-4 border-blue-500 pl-4">
              <p className="leading-relaxed">{booking.userEventDetails}</p>
            </div>
          ) : (
            <p className="italic text-muted-foreground">
              No notes provided for this booking.
            </p>
          )}
        </Section>

        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
          {canStart && onStart && (
            <Button variant="default" onClick={() => setShowStartDialog(true)}>
              Start Pickup
            </Button>
          )}
          <ExtendBookingButton
            bookingId={booking.id}
            status={booking.status}
            onExtend={() => router.invalidate()}
          />
          {canCancel && onCancel && (
            <Button
              variant="destructive"
              onClick={() => setShowCancelDialog(true)}
            >
              Cancel Booking
            </Button>
          )}
          {canReturn && telegramBotUsername && (
            <Button variant="default" asChild>
              <a
                href={createTelegramBotLink(telegramBotUsername)}
                target="_blank"
                rel="noopener noreferrer"
                title="Open the Telegram bot to return this booking. Send /return_equipment."
              >
                <PackageCheck className="mr-1.5 h-4 w-4" />
                Return Booking
              </a>
            </Button>
          )}
          {editable && (
            <Link to={editTo} params={{ bookingId: booking.id.toString() }}>
              <Button variant="outline">
                <Pencil className="mr-1.5 h-4 w-4" />
                {editLabel}
              </Button>
            </Link>
          )}
        </div>
      </div>

      <CancelBookingItemDialog
        bookingId={booking.id}
        item={pendingCancelItem}
        onOpenChange={(open) => {
          if (!open) setPendingCancelItem(null)
        }}
        onCancelled={handleItemCancelled}
      />

      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Pickup</AlertDialogTitle>
            <AlertDialogDescription>
              Start this booking now? The equipment will be marked as picked up
              and the calendar event will be updated with the actual start time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Not Now</AlertDialogCancel>
            <AlertDialogAction onClick={handleStart} disabled={isStarting}>
              {isStarting ? 'Starting...' : 'Start Booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
            <AlertDialogDescription>{cancelDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCancelling}>
              Keep Booking
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={isCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  )
}
