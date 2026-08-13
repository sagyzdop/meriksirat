import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { createEquipmentAdminFn, uploadEquipmentImageFn } from '@/lib/equipment'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { EquipmentFormFields } from '@/components/admin/equipment/components/equipment-form-fields'
import { EquipmentImageField } from '@/components/admin/equipment/components/equipment-image-field'
import { Save } from 'lucide-react'

const createEquipmentSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  shortName: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.number().min(1, 'Category is required'),
  googleCalendarId: z.string().min(1, 'Google Calendar ID is required'),
  requiredClearanceLevel: z
    .number()
    .min(1, 'Clearance level must be at least 1')
    .max(10, 'Clearance level cannot exceed 10'),
})

type CreateEquipmentForm = z.infer<typeof createEquipmentSchema>

interface PageProps {
  categories: any[]
}

export function Page({ categories }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const form = useForm<CreateEquipmentForm>({
    resolver: zodResolver(createEquipmentSchema),
    defaultValues: {
      modelName: '',
      shortName: '',
      description: '',
      categoryId: undefined,
      googleCalendarId: '',
      requiredClearanceLevel: 1,
    },
  })

  const onSubmit = async (data: CreateEquipmentForm) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      const result = await createEquipmentAdminFn({ data })

      if (!result?.equipmentId) {
        throw new Error('Failed to create equipment - no ID returned')
      }

      let imagePath: string | undefined

      if (selectedImage) {
        setIsUploadingImage(true)
        try {
          const reader = new FileReader()
          const imageData = await new Promise<string>((resolve, reject) => {
            reader.onload = () => resolve(reader.result as string)
            reader.onerror = reject
            reader.readAsDataURL(selectedImage)
          })

          const uploadResult = await uploadEquipmentImageFn({
            data: {
              equipmentId: result.equipmentId,
              imageData,
              contentType: selectedImage.type,
              fileName: selectedImage.name,
            },
          })
          imagePath = uploadResult?.imagePath
        } catch {
          setError(
            'Equipment created successfully, but image upload failed. You can add an image later by editing the equipment.'
          )
        } finally {
          setIsUploadingImage(false)
        }
      }

      setSuccess(
        `Equipment "${data.modelName}" created successfully!${
          imagePath ? ' Image uploaded.' : ''
        }`
      )

      setTimeout(() => {
        navigate({ to: '/admin/equipment' })
      }, 1500)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to create equipment. Please try again.'
      )
    } finally {
      setIsSubmitting(false)
      setIsUploadingImage(false)
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Create New Equipment"
        description="Add new equipment to the catalog with model details and calendar integration"
        onBack={() => history.back()}
      />

      <Section spacing="compact">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <EquipmentImageField
              label="Equipment Image"
              helperText="Upload an image of the equipment (optional). Max size: 5MB. Formats: JPEG, PNG, WebP"
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
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-200 bg-green-50 text-green-800">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-end">
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
                    : 'Creating Equipment...'
                  : 'Create Equipment'}
              </Button>
            </div>
          </form>
        </Form>
      </Section>
    </PageContainer>
  )
}
