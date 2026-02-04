import { useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { deleteEquipmentAdminFn } from "@/lib/equipment"
import { EquipmentWithCategory } from "@/lib/equipment"
import { useRouter } from "@tanstack/react-router"

interface EquipmentDeleteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment: EquipmentWithCategory | null
}

export function EquipmentDeleteDialog({
  open,
  onOpenChange,
  equipment,
}: EquipmentDeleteDialogProps) {
  const router = useRouter()
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!equipment) return

    setIsDeleting(true)
    try {
      const result = await deleteEquipmentAdminFn({
        data: { equipmentId: equipment.id },
      })

      if (result.action === "deleted") {
        toast.success(result.message || "Equipment deleted successfully")
      } else if (result.action === "deactivated") {
        toast.warning(result.message || "Equipment has been deactivated")
      }

      onOpenChange(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete equipment"
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the equipment{" "}
            <span className="font-semibold">{equipment?.modelName}</span>.
            {" "}If there are active bookings, the equipment will be marked as inactive instead.
            This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={isDeleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {isDeleting ? "Deleting..." : "Delete Equipment"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
