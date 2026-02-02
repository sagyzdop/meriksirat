import { useState } from 'react'
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
import { Alert, AlertDescription } from '@/components/ui/alert'
import { deleteCategoryFn } from '@/lib/admin'
import { toast } from 'sonner'
import { CategoryWithCount } from '..'
import { AlertTriangle } from 'lucide-react'

interface DeleteCategoryDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onClose: () => void
  category: CategoryWithCount
}

export function DeleteCategoryDialog({ open, onOpenChange, onClose, category }: DeleteCategoryDialogProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    setIsLoading(true)

    try {
      await deleteCategoryFn({
        data: { categoryId: category.id }
      })

      toast.success(
        category.equipmentCount > 0 
          ? `Category "${category.name}" deleted and ${category.equipmentCount} equipment items moved to "Uncategorized"`
          : `Category "${category.name}" deleted successfully`
      )
      
      onClose()
      
      // Refresh the page data
      router.invalidate()
    } catch (error) {
      console.error('Failed to delete category:', error)
      
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          toast.error('Category not found')
          onClose()
        } else {
          toast.error(error.message)
        }
      } else {
        toast.error('Failed to delete category')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      onClose()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Delete Category
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. Are you sure you want to delete this category?
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-muted/50 p-4 rounded-lg">
            <h4 className="font-semibold">{category.name}</h4>
            {category.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {category.description}
              </p>
            )}
            <p className="text-sm text-muted-foreground mt-2">
              <strong>Equipment Count:</strong> {category.equipmentCount} {category.equipmentCount === 1 ? 'item' : 'items'}
            </p>
          </div>

          {category.equipmentCount > 0 && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                This category contains {category.equipmentCount} equipment {category.equipmentCount === 1 ? 'item' : 'items'}. 
                All equipment will be automatically moved to the "Uncategorized" category.
              </AlertDescription>
            </Alert>
          )}

          <Alert className="border-destructive/50 text-destructive dark:border-destructive [&>svg]:text-destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <strong>Warning:</strong> This action cannot be undone. The category will be permanently deleted.
            </AlertDescription>
          </Alert>
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
            variant="destructive"
            onClick={handleDelete}
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete Category'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}