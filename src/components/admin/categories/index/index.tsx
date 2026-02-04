import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { CategoryDataTable } from './components/category-data-table'
import { CreateCategoryDialog } from './components/create-category-dialog'
import { EditCategoryDialog } from './components/edit-category-dialog'
import { DeleteCategoryDialog } from './components/delete-category-dialog'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'

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

  const description = categories.length > 0
    ? `Managing ${categories.length} categor${categories.length === 1 ? 'y' : 'ies'}`
    : "No categories found"

  return (
    <PageContainer>
      <PageHeader
        title="Manage Categories"
        description={description}
        actions={
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Category
          </Button>
        }
      />

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
    </PageContainer>
  )
}