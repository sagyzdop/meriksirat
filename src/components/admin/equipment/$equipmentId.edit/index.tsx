import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import {
  updateEquipmentAdminFn,
  deleteEquipmentAdminFn,
  uploadEquipmentImageFn,
} from '@/lib/equipment'
import type { EquipmentWithCategory } from '@/lib/equipment/types'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
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
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { EquipmentFormFields } from '@/components/admin/equipment/components/equipment-form-fields'
import { EquipmentImageField } from '@/components/admin/equipment/components/equipment-image-field'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import { Save, Trash2, AlertTriangle } from 'lucide-react'

const editEquipmentSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  shortName: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.number().min(1, 'Category is required'),
  googleCalendarId: z.string().min(1, 'Google Calendar ID is required'),
  requiredClearanceLevel: z
    .number()
    .min(1, 'Clearance level must be at least 1')
    .max(10, 'Clearance level cannot exceed 10'),
  isActive: z.boolean(),
})

type EditEquipmentForm = z.infer<typeof editEquipmentSchema>

interface PageProps {
  equipment: EquipmentWithCategory
  categories: Array<{
    id: number
    name: string
    description: string | null
    sortOrder: number | null
    createdAt: Date | null
    updatedAt: Date | null
  }>
  equipmentId: number
}

export function Page({ equipment, categories, equipmentId }: PageProps) {
  const navigate = useNavigate()
  const goBack = useBackNavigation('/admin/equipment')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const form = useForm<EditEquipmentForm>({
    resolver: zodResolver(editEquipmentSchema),
    defaultValues: {
      modelName: equipment.modelName || '',
      shortName: equipment.shortName || '',
      description: equipment.description || '',
      categoryId: equipment.categoryId || undefined,
      googleCalendarId: equipment.googleCalendarId || '',
      requiredClearanceLevel: equipment.requiredClearanceLevel || 1,
      isActive: equipment.isActive ?? true,
    },
  })

  const onSubmit = async (data: EditEquipmentForm) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      await updateEquipmentAdminFn({
        data: {
          equipmentId,
          ...data,
        },
      })

      if (selectedImage) {
        setIsUploadingImage(true)
        try {
          const reader = new FileReader()
          const imageData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(selectedImage)
          })

          await uploadEquipmentImageFn({
            data: {
              equipmentId,
              imageData,
              contentType: selectedImage.type,
              fileName: selectedImage.name,
            },
          })
          setSuccess(
            `Equipment "${data.modelName}" updated successfully with new image!`
          )
        } catch {
          setSuccess(
            `Equipment "${data.modelName}" updated successfully, but image upload failed. You can try uploading the image again.`
          )
        } finally {
          setIsUploadingImage(false)
        }
      } else {
        setSuccess(`Equipment "${data.modelName}" updated successfully!`)
      }

      setTimeout(() => {
        navigate({ to: '/admin/equipment' })
      }, 1500)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to update equipment. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
      setIsUploadingImage(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await deleteEquipmentAdminFn({
        data: { equipmentId },
      })

      if (result?.action === 'deactivated') {
        setSuccess(result.message)
        form.setValue('isActive', false)
        setTimeout(() => {
          navigate({ to: '/admin/equipment' })
        }, 2000)
      } else if (result?.action === 'deleted') {
        setSuccess(result.message)
        setTimeout(() => {
          navigate({ to: '/admin/equipment' })
        }, 1500)
      }
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to delete equipment. Please try again.'
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Edit Equipment"
        description="Modify equipment properties, status, and manage deletion"
        onBack={goBack}
      />

      <div className="space-y-8">
        <Section spacing="compact">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Status</FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Inactive equipment will not be available for new
                        bookings
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <EquipmentImageField
                label="Update Equipment Image"
                helperText="Upload a new image to replace the current one (optional). Max size: 5MB. Formats: JPEG, PNG, WebP"
                disabled={isSubmitting}
                onImageSelected={setSelectedImage}
                onError={setError}
              />

              <EquipmentFormFields
                form={form}
                categories={categories}
                disabled={isSubmitting}
              />

              {error && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert className="border-green-200 bg-green-50 text-green-800">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={isSubmitting || isDeleting}
                      className="flex items-center gap-2 w-full sm:w-auto"
                    >
                      <Trash2 className="h-4 w-4" />
                      {isDeleting ? 'Deleting...' : 'Delete Equipment'}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
                      <AlertDialogDescription className="space-y-2">
                        <p>
                          Are you sure you want to delete "{equipment.modelName}
                          "?
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Note:</strong> If this equipment has active
                          bookings, it will be marked as inactive instead of
                          being deleted to preserve booking history.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>
                        Cancel
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {isDeleting ? 'Deleting...' : 'Delete Equipment'}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate({ to: '/admin/equipment' })}
                    disabled={isSubmitting}
                    className="w-full sm:w-auto"
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploadingImage}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting
                      ? isUploadingImage
                        ? 'Uploading Image...'
                        : 'Saving Changes...'
                      : 'Save Changes'}
                  </Button>
                </div>
              </div>
            </form>
          </Form>
        </Section>
      </div>
    </PageContainer>
  )
}
