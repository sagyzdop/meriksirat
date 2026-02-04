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
import { bulkUpdateUserClearanceFn } from "@/lib/user/functions"

const bulkEditSchema = z.object({
    clearanceLevel: z.number().min(1).max(10),
})

type BulkEditFormData = z.infer<typeof bulkEditSchema>

interface BulkEditClearanceDialogProps {
    userIds: string[]
    open: boolean
    onOpenChange: (open: boolean) => void
    onSuccess?: () => void
}

export function BulkEditClearanceDialog({ userIds, open, onOpenChange, onSuccess }: BulkEditClearanceDialogProps) {
    const form = useForm<BulkEditFormData>({
        resolver: zodResolver(bulkEditSchema),
        defaultValues: {
            clearanceLevel: 0,
        },
    })

    const onSubmit = async (values: BulkEditFormData) => {
        try {
            await bulkUpdateUserClearanceFn({
                data: {
                    userIds,
                    clearanceLevel: values.clearanceLevel,
                }
            })
            toast.success(`Updated clearance level for ${userIds.length} user(s)`)
            onOpenChange(false)
            if (onSuccess) {
                onSuccess()
            }
        } catch (error) {
            toast.error("Failed to update users", {
                description: error instanceof Error ? error.message : "An error occurred"
            })
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Bulk Edit Clearance Level</DialogTitle>
                    <DialogDescription>
                        This will update the clearance level for {userIds.length} selected user(s).
                    </DialogDescription>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
