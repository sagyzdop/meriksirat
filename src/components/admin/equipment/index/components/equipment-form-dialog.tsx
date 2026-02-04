import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { createEquipmentAdminFn, updateEquipmentAdminFn, getCategoriesFn } from "@/lib/equipment"
import { EquipmentWithCategory } from "@/lib/equipment"
import { useRouter } from "@tanstack/react-router"

const formSchema = z.object({
  modelName: z.string().min(1, "Model name is required").max(100, "Model name must be at most 100 characters"),
  shortName: z.string().max(50, "Short name must be at most 50 characters").optional(),
  description: z.string().max(500, "Description must be at most 500 characters").optional(),
  categoryId: z.number().min(1, "Category is required"),
  googleCalendarId: z.string().min(1, "Google Calendar ID is required").max(255, "Calendar ID must be at most 255 characters"),
  requiredClearanceLevel: z.number().min(1, "Clearance level must be at least 1").max(10, "Clearance level must be at most 10"),
  imagePath: z.string().max(255, "Image path must be at most 255 characters").optional(),
})

type FormData = z.infer<typeof formSchema>

interface Category {
  id: number
  name: string
  description: string | null
  sortOrder: number | null
}

interface EquipmentFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  equipment?: EquipmentWithCategory | null
  mode: "add" | "edit"
}

export function EquipmentFormDialog({
  open,
  onOpenChange,
  equipment,
  mode,
}: EquipmentFormDialogProps) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>([])
  const [isLoadingCategories, setIsLoadingCategories] = useState(true)

  // Load categories when dialog opens
  useEffect(() => {
    if (open) {
      loadCategories()
    }
  }, [open])

  const loadCategories = async () => {
    setIsLoadingCategories(true)
    try {
      const result = await getCategoriesFn()
      if (result) {
        setCategories(result)
      }
    } catch {
      toast.error("Failed to load categories")
    } finally {
      setIsLoadingCategories(false)
    }
  }

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      modelName: equipment?.modelName || "",
      shortName: equipment?.shortName || "",
      description: equipment?.description || "",
      categoryId: equipment?.categoryId || undefined,
      googleCalendarId: equipment?.googleCalendarId || "",
      requiredClearanceLevel: equipment?.requiredClearanceLevel || 1,
      imagePath: equipment?.imagePath || "",
    },
  })

  // Reset form when dialog closes or equipment changes
  useEffect(() => {
    if (open && equipment) {
      form.reset({
        modelName: equipment.modelName,
        shortName: equipment.shortName || "",
        description: equipment.description || "",
        categoryId: equipment.categoryId || undefined,
        googleCalendarId: equipment.googleCalendarId,
        requiredClearanceLevel: equipment.requiredClearanceLevel || 1,
        imagePath: equipment.imagePath || "",
      })
    } else if (open && !equipment) {
      form.reset({
        modelName: "",
        shortName: "",
        description: "",
        categoryId: undefined,
        googleCalendarId: "",
        requiredClearanceLevel: 1,
        imagePath: "",
      })
    }
  }, [open, equipment, form])

  const onSubmit = async (values: FormData) => {
    try {
      if (mode === "edit" && equipment) {
        // Update existing equipment
        await updateEquipmentAdminFn({
          data: {
            equipmentId: equipment.id,
            ...values,
          },
        })
        toast.success("Equipment updated successfully")
      } else {
        // Create new equipment
        await createEquipmentAdminFn({
          data: values,
        })
        toast.success("Equipment created successfully")
      }
      
      onOpenChange(false)
      form.reset()
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to save equipment"
      )
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit" ? "Edit Equipment" : "Add Equipment"}
          </DialogTitle>
          <DialogDescription>
            {mode === "edit"
              ? "Update the equipment details below."
              : "Fill in the details to add new equipment."}
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="modelName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Model Name <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., MacBook Pro 16-inch"
                    />
                  </FormControl>
                  <FormDescription>
                    The full model name of the equipment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="shortName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short Name</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., MBP16"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional short name for display in compact views
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe the equipment, its features, and specifications..."
                      className="min-h-[100px]"
                    />
                  </FormControl>
                  <FormDescription>
                    Detailed description of the equipment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="categoryId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Category <span className="text-destructive">*</span>
                  </FormLabel>
                  <Select
                    value={field.value?.toString()}
                    onValueChange={(value) => field.onChange(parseInt(value))}
                    disabled={isLoadingCategories}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={isLoadingCategories ? "Loading..." : "Select a category"} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {[...categories]
                        .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                        .map((category) => (
                          <SelectItem key={category.id} value={category.id.toString()}>
                            {category.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The category this equipment belongs to
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="googleCalendarId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Google Calendar ID <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., calendar@group.calendar.google.com"
                    />
                  </FormControl>
                  <FormDescription>
                    The Google Calendar ID for booking this equipment
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="requiredClearanceLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Required Clearance Level <span className="text-destructive">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      type="number"
                      min="1"
                      max="10"
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                    />
                  </FormControl>
                  <FormDescription>
                    Minimum clearance level required to book this equipment (1-10)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imagePath"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image Path</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="e.g., equipment-images/macbook-pro.jpg"
                    />
                  </FormControl>
                  <FormDescription>
                    Optional path to the equipment image in storage
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? mode === "edit"
                    ? "Updating..."
                    : "Creating..."
                  : mode === "edit"
                  ? "Update Equipment"
                  : "Create Equipment"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
