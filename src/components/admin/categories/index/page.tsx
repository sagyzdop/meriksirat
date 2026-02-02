import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CategoryDataTable } from './components/category-data-table'
import { CreateCategoryDialog } from './components/create-category-dialog'
import { EditCategoryDialog } from './components/edit-category-dialog'
import { DeleteCategoryDialog } from './components/delete-category-dialog'

export interface CategoryWithCount {
  id: number
  name: string
  description: string | null
  sortOrder: number
  createdAt: Date
  updatedAt: Date
  equipmentCount: number
}

interface PageProps {
  categories: CategoryWithCount[]
}

export function Page({ categories }: PageProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<CategoryWithCount | null>(null)

  const handleEdit = (category: CategoryWithCount) => {
    setSelectedCategory(category)
    setEditDialogOpen(true)
  }

  const handleDelete = (category: CategoryWithCount) => {
    setSelectedCategory(category)
    setDeleteDialogOpen(true)
  }

  const handleCloseDialogs = () => {
    setCreateDialogOpen(false)
    setEditDialogOpen(false)
    setDeleteDialogOpen(false)
    setSelectedCategory(null)
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Category Management</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage equipment categories and their organization
          </p>
        </div>
        <Button onClick={() => setCreateDialogOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Add Category
        </Button>
      </div>

      <CategoryDataTable 
        categories={categories}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <CreateCategoryDialog 
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onClose={handleCloseDialogs}
      />

      {selectedCategory && (
        <>
          <EditCategoryDialog 
            open={editDialogOpen}
            onOpenChange={setEditDialogOpen}
            onClose={handleCloseDialogs}
            category={selectedCategory}
          />

          <DeleteCategoryDialog 
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
            onClose={handleCloseDialogs}
            category={selectedCategory}
          />
        </>
      )}
    </div>
  )
}