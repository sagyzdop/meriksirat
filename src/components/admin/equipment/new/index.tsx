import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { createEquipmentFn } from '@/lib/equipment'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import {
  EquipmentFormFields,
  equipmentFormSchema,
} from '@/components/admin/equipment/components/equipment-form-fields'
import type { z } from 'zod'
import type { EquipmentFormCategory } from '@/components/admin/equipment/components/equipment-form-fields'
import { uploadEquipmentImage } from '@/components/admin/equipment/components/upload-equipment-image'
import { EquipmentImageField } from '@/components/admin/equipment/components/equipment-image-field'
import { useBackNavigation } from '@/hooks/use-back-navigation'
import { Save } from 'lucide-react'
import { errorMessage } from '@/lib/utils'

type CreateEquipmentForm = z.infer<typeof equipmentFormSchema>

interface PageProps {
  categories: EquipmentFormCategory[]
}

export function Page({ categories }: PageProps) {
  const navigate = useNavigate()
  const goBack = useBackNavigation('/admin/equipment')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)

  const form = useForm<CreateEquipmentForm>({
    resolver: zodResolver(equipmentFormSchema),
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
      const result = await createEquipmentFn({ data })

      if (!result?.equipmentId) {
        throw new Error('Failed to create equipment - no ID returned')
      }

      let imagePath: string | undefined

      if (selectedImage) {
        setIsUploadingImage(true)
        try {
          const uploadResult = await uploadEquipmentImage(
            result.equipmentId,
            selectedImage
          )
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
        errorMessage(error, 'Failed to create equipment. Please try again.')
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
        onBack={goBack}
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
