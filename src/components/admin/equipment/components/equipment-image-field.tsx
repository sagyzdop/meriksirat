import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, X } from 'lucide-react'

interface EquipmentImageFieldProps {
  disabled?: boolean
  label: string
  helperText: string
  onImageSelected: (file: File | null) => void
  onError: (message: string | null) => void
}

/**
 * Image upload field shared by the create/edit equipment forms.
 * Manages file selection, preview, and validation internally and reports the
 * chosen file (or null) to the parent through `onImageSelected`.
 */
export function EquipmentImageField({
  disabled,
  label,
  helperText,
  onImageSelected,
  onError,
}: EquipmentImageFieldProps) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      onError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.')
      return
    }

    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      onError('File size too large. Maximum size is 5MB.')
      return
    }

    setSelectedImage(file)
    onError(null)
    onImageSelected(file)

    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleRemoveImage = () => {
    setSelectedImage(null)
    setImagePreview(null)
    onImageSelected(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
        <p className="text-sm text-muted-foreground">{helperText}</p>
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
            disabled={disabled}
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
          disabled={disabled}
          className="hidden"
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {selectedImage ? 'Change Image' : 'Select Image'}
        </Button>
        {selectedImage && (
          <span className="text-sm text-muted-foreground">
            {selectedImage.name} (
            {(selectedImage.size / 1024 / 1024).toFixed(2)} MB)
          </span>
        )}
      </div>
    </div>
  )
}
