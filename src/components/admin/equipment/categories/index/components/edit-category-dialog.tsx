import { useState, useEffect } from 'react'
import { useRouter } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { updateCategoryFn } from '@/lib/admin'
import { toast } from 'sonner'
import { CategoryWithCount } from '..'

interface EditCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  category: CategoryWithCount
}

export function EditCategoryDialog({
  open,
  onOpenChange,
  onClose,
  category,
}: EditCategoryDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    sortOrder: 0,
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form data when category changes
  useEffect(() => {
    if (category) {
      setFormData({
        name: category.name,
        description: category.description || '',
        sortOrder: category.sortOrder,
      })
      setErrors({})
    }
  }, [category])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setErrors({})

    try {
      await updateCategoryFn({
        data: {
          categoryId: category.id,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          sortOrder: formData.sortOrder,
        },
      })

      toast.success('Category updated successfully')
      onClose()

      // Refresh the page data
      router.invalidate()
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('already exists')) {
          setErrors({ name: 'A category with this name already exists' })
        } else if (error.message.includes('not found')) {
          toast.error('Category not found')
          onClose()
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Failed to update category')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      // Reset form to original values
      setFormData({
        name: category.name,
        description: category.description || '',
        sortOrder: category.sortOrder,
      })
      setErrors({})
      onClose()
    }
  }

  const hasChanges =
    formData.name !== category.name ||
    formData.description !== (category.description || '') ||
    formData.sortOrder !== category.sortOrder

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-106.25 max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Edit Category</DialogTitle>
          <DialogDescription>
            Update the category information and organization.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-h-[60vh] overflow-y-auto pr-1 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter category name"
                disabled={isLoading}
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Enter category description (optional)"
                disabled={isLoading}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-sortOrder">Sort Order</Label>
              <Input
                id="edit-sortOrder"
                type="number"
                value={formData.sortOrder}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    sortOrder: parseInt(e.target.value) || 0,
                  }))
                }
                placeholder="0"
                disabled={isLoading}
                min="0"
              />
              <p className="text-sm text-muted-foreground">
                Lower numbers appear first in the list
              </p>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Equipment Count:</strong> {category.equipmentCount}{' '}
                {category.equipmentCount === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !formData.name.trim() || !hasChanges}
            >
              {isLoading ? 'Updating...' : 'Update Category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
