import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"

const bulkEditSchema = z.object({
  clearanceLevel: z.number().min(1).max(10),
})

type BulkEditFormData = z.infer<typeof bulkEditSchema>

interface BulkEditClearanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  /** Noun describing the affected rows, e.g. "equipment item(s)". */
  itemNoun: string
  /** Short verb phrase for the dialog, e.g. "update the required clearance level". */
  actionPhrase: string
  successMessage: string
  errorTitle: string
  onSubmit: (clearanceLevel: number) => Promise<void>
  onSuccess?: () => void
}

/**
 * Generic "bulk edit clearance level" dialog shared by the admin equipment and
 * admin users data tables. The caller supplies the mutation and the labels.
 */
export function BulkEditClearanceDialog({
  open,
  onOpenChange,
  count,
  itemNoun,
  actionPhrase,
  successMessage,
  errorTitle,
  onSubmit,
  onSuccess,
}: BulkEditClearanceDialogProps) {
  const form = useForm<BulkEditFormData>({
    resolver: zodResolver(bulkEditSchema),
    defaultValues: {
      clearanceLevel: 0,
    },
  })

  const handleSubmit = async (values: BulkEditFormData) => {
    try {
      await onSubmit(values.clearanceLevel)
      toast.success(successMessage)
      onOpenChange(false)
      onSuccess?.()
    } catch (error) {
      toast.error(errorTitle, {
        description:
          error instanceof Error ? error.message : "An error occurred",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Bulk Edit Clearance Level</DialogTitle>
          <DialogDescription>
            This will {actionPhrase} for {count} selected {itemNoun}.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clearanceLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Clearance Level</FormLabel>
                  <Select
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    value={field.value.toString()}
                    disabled={form.formState.isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select clearance level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[...Array(10)].map((_, i) => (
                        <SelectItem key={i} value={(i + 1).toString()}>
                          Level {i + 1}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={form.formState.isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? "Updating..." : "Update All"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
