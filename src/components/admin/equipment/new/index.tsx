import { useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useRef } from 'react'
import { createEquipmentAdminFn, uploadEquipmentImageFn } from '@/lib/equipment'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Camera, Upload, X } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'

const createEquipmentSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  shortName: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.number().min(1, 'Category is required'),
  googleCalendarId: z.string().min(1, 'Google Calendar ID is required'),
  requiredClearanceLevel: z.number().min(1, 'Clearance level must be at least 1').max(10, 'Clearance level cannot exceed 10'),
})

type CreateEquipmentForm = z.infer<typeof createEquipmentSchema>

interface PageProps {
  categories: any[]
}

export function Page({ categories }: PageProps) {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      setError('File size too large. Maximum size is 5MB.')
      return
    }

    setSelectedImage(file)
    setError(null)

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

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
            }
          })
          imagePath = uploadResult?.imagePath
        } catch {
          setError('Equipment created successfully, but image upload failed. You can add an image later by editing the equipment.')
        } finally {
          setIsUploadingImage(false)
        }
      }

      setSuccess(`Equipment "${data.modelName}" created successfully!${imagePath ? ' Image uploaded.' : ''}`)
      
      setTimeout(() => {
        navigate({ to: '/admin/equipment' })
      }, 1500)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to create equipment. Please try again.')
    } finally {
      setIsSubmitting(false)
      setIsUploadingImage(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/admin/equipment' })
  }

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
            Back to Equipment
          </Button>
          <div className="flex flex-col gap-1">
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Create New Equipment</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Add new equipment to the catalog with model details and calendar integration
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Equipment Details
          </CardTitle>
          <CardDescription>
            Enter the equipment information including model name, category, and Google Calendar ID
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="modelName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Model Name *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Canon EOS R5, Sony A7 IV"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
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
                          placeholder="e.g., R5, A7IV (optional)"
                          {...field}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of the equipment, specifications, included accessories, etc."
                        className="min-h-[100px]"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
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
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="requiredClearanceLevel"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Required Clearance Level *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="1"
                          max="10"
                          placeholder="1-10"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          disabled={isSubmitting}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="googleCalendarId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Google Calendar ID *</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g., equipment-camera-01@example.com"
                        {...field}
                        disabled={isSubmitting}
                      />
                    </FormControl>
                    <p className="text-sm text-muted-foreground">
                      Each equipment must have a unique Google Calendar ID for booking management
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Equipment Image
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Upload an image of the equipment (optional). Max size: 5MB. Formats: JPEG, PNG, WebP
                  </p>
                </div>

                {imagePreview && (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="Equipment preview"
                      className="h-32 w-32 object-cover rounded-lg border"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute -top-2 -right-2 h-6 w-6 rounded-full p-0"
                      onClick={handleRemoveImage}
                      disabled={isSubmitting}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                )}

                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp"
                    onChange={handleImageSelect}
                    disabled={isSubmitting}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="flex items-center gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    {selectedImage ? 'Change Image' : 'Select Image'}
                  </Button>
                  {selectedImage && (
                    <span className="text-sm text-muted-foreground">
                      {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  )}
                </div>
              </div>

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

              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center">
                <Button
                  type="submit"
                  disabled={isSubmitting || isUploadingImage}
                  className="flex items-center gap-2 w-full sm:w-auto"
                >
                  <Save className="h-4 w-4" />
                  {isSubmitting 
                    ? (isUploadingImage ? 'Uploading Image...' : 'Creating Equipment...') 
                    : 'Create Equipment'
                  }
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
