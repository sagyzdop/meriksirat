import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState, useRef } from 'react'
import { getAdminEquipmentByIdFn, updateEquipmentAdminFn, deleteEquipmentAdminFn, getCategoriesFn, uploadEquipmentImageFn } from '@/lib/equipment'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ArrowLeft, Save, Camera, Upload, X, Trash2, AlertTriangle } from 'lucide-react'
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

// Form validation schema
const editEquipmentSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  shortName: z.string().optional(),
  description: z.string().optional(),
  categoryId: z.number().min(1, 'Category is required'),
  googleCalendarId: z.string().min(1, 'Google Calendar ID is required'),
  requiredClearanceLevel: z.number().min(1, 'Clearance level must be at least 1').max(10, 'Clearance level cannot exceed 10'),
  isActive: z.boolean(),
})

type EditEquipmentForm = z.infer<typeof editEquipmentSchema>

export const Route = createFileRoute('/_authenticated/admin/equipment/$/edit')({
  component: RouteComponent,
  loader: async ({ params }) => {
    const equipmentId = parseInt(params._splat)
    if (!equipmentId || isNaN(equipmentId)) {
      throw new Error('Equipment ID is required')
    }

    try {
      // Get both equipment and categories
      const [equipment, categories] = await Promise.all([
        getAdminEquipmentByIdFn({ data: { equipmentId } }),
        getCategoriesFn()
      ])

      if (!equipment) {
        throw new Error('Equipment not found')
      }

      return { 
        equipment,
        categories: categories || [],
        equipmentId 
      }
    } catch (error) {
      console.error('Failed to load equipment:', error)
      throw new Error('Failed to load equipment data')
    }
  },
})

function RouteComponent() {
  const { equipment, categories, equipmentId } = Route.useLoaderData()
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
      return
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      setError('File size too large. Maximum size is 5MB.')
      return
    }

    setSelectedImage(file)
    setError(null)

    // Create preview
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

  const onSubmit = async (data: EditEquipmentForm) => {
    setIsSubmitting(true)
    setError(null)
    setSuccess(null)

    try {
      // Update equipment data
      await updateEquipmentAdminFn({ 
        data: {
          equipmentId,
          ...data,
        }
      })

      // Upload new image if selected
      if (selectedImage) {
        setIsUploadingImage(true)
        try {
          // Convert File to base64
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
            }
          })
          setSuccess(`Equipment "${data.modelName}" updated successfully with new image!`)
        } catch (uploadError) {
          console.error('Image upload failed:', uploadError)
          setSuccess(`Equipment "${data.modelName}" updated successfully, but image upload failed. You can try uploading the image again.`)
        } finally {
          setIsUploadingImage(false)
        }
      } else {
        setSuccess(`Equipment "${data.modelName}" updated successfully!`)
      }
      
      // Navigate back to equipment list after a short delay
      setTimeout(() => {
        navigate({ to: '/admin/equipment' })
      }, 1500)
    } catch (error) {
      console.error('Failed to update equipment:', error)
      setError(error instanceof Error ? error.message : 'Failed to update equipment. Please try again.')
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
        data: { equipmentId }
      })

      if (result?.action === 'deactivated') {
        setSuccess(result.message)
        // Refresh the form to show the updated status
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
      console.error('Failed to delete equipment:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete equipment. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleCancel = () => {
    navigate({ to: '/admin/equipment' })
  }

  return (
    <div className="h-full flex-1 flex-col gap-6 p-4 sm:gap-8 sm:p-8 md:flex">
      {/* Header */}
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
            <h2 className="text-xl sm:text-2xl font-semibold tracking-tight">Edit Equipment</h2>
            <p className="text-sm sm:text-base text-muted-foreground">
              Modify equipment properties, status, and manage deletion
            </p>
          </div>
        </div>
      </div>

      {/* Equipment Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Equipment Information
          </CardTitle>
          <CardDescription>
            Editing: {equipment.modelName} (ID: {equipment.id})
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Equipment ID:</span>
              <span className="ml-2 font-mono text-muted-foreground">{equipment.id}</span>
            </div>
            <div>
              <span className="font-medium">Calendar ID:</span>
              <span className="ml-2 font-mono text-muted-foreground break-all">{equipment.googleCalendarId}</span>
            </div>
            <div>
              <span className="font-medium">Current Category:</span>
              <Badge variant="outline" className="ml-2">
                {equipment.category?.name || 'Uncategorized'}
              </Badge>
            </div>
            <div>
              <span className="font-medium">Current Status:</span>
              <Badge variant={equipment.isActive ? 'default' : 'secondary'} className="ml-2">
                {equipment.isActive ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
          
          {/* Current Image Display */}
          {equipment.imagePath && (
            <div className="space-y-2">
              <span className="text-sm font-medium">Current Image:</span>
              <div className="relative inline-block">
                <img
                  src={`/api/images/${equipment.imagePath}`}
                  alt={equipment.modelName}
                  className="h-32 w-32 object-cover rounded-lg border"
                  onError={(e) => {
                    // Hide image if it fails to load
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Form */}
      <Card>
        <CardHeader>
          <CardTitle>Edit Equipment Details</CardTitle>
          <CardDescription>
            Update equipment properties including model name, category, and active status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Model Name and Short Name */}
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

              {/* Description */}
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

              {/* Category and Clearance Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(parseInt(value))}
                        value={field.value?.toString()}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
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

              {/* Google Calendar ID */}
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

              {/* Active Status */}
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">
                        Active Status
                      </FormLabel>
                      <p className="text-sm text-muted-foreground">
                        Inactive equipment will not be available for new bookings
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

              {/* Image Upload */}
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Update Equipment Image
                  </label>
                  <p className="text-sm text-muted-foreground">
                    Upload a new image to replace the current one (optional). Max size: 5MB. Formats: JPEG, PNG, WebP
                  </p>
                </div>

                {/* Image Preview */}
                {imagePreview && (
                  <div className="relative inline-block">
                    <img
                      src={imagePreview}
                      alt="New equipment preview"
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

                {/* File Input */}
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
                    {selectedImage ? 'Change Image' : 'Select New Image'}
                  </Button>
                  {selectedImage && (
                    <span className="text-sm text-muted-foreground">
                      {selectedImage.name} ({(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
                    </span>
                  )}
                </div>
              </div>

              {/* Error and Success Messages */}
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

              {/* Form Actions */}
              <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <Button
                    type="submit"
                    disabled={isSubmitting || isUploadingImage}
                    className="flex items-center gap-2 w-full sm:w-auto"
                  >
                    <Save className="h-4 w-4" />
                    {isSubmitting 
                      ? (isUploadingImage ? 'Uploading Image...' : 'Saving Changes...') 
                      : 'Save Changes'
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

                {/* Delete Button */}
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
                          Are you sure you want to delete "{equipment.modelName}"?
                        </p>
                        <p className="text-sm text-muted-foreground">
                          <strong>Note:</strong> If this equipment has active bookings, it will be marked as inactive instead of being deleted to preserve booking history.
                        </p>
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
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
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}