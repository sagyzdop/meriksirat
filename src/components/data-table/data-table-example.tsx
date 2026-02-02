/**
 * DataTable Usage Example
 * 
 * This file demonstrates how to use the DataTable component with custom mobile card rendering.
 * 
 * Key Features Demonstrated:
 * 1. Desktop table view with sorting and filtering
 * 2. Mobile card view with custom rendering
 * 3. Loading states
 * 4. Empty states
 * 5. Row click handling
 * 
 * Requirements: 2.4, 7.4
 */

import { DataTable } from "./data-table"
import { ColumnDef } from "@tanstack/react-table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ArrowUpDown } from "lucide-react"

// Example data type
interface Equipment {
  id: number
  modelName: string
  description: string
  category: string
  isActive: boolean
  clearanceLevel: number
}

// Example column definitions
const exampleColumns: ColumnDef<Equipment>[] = [
  {
    accessorKey: "modelName",
    header: ({ column }) => (
      <Button
        variant="ghost"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Model Name
        <ArrowUpDown className="ml-2 h-4 w-4" />
      </Button>
    ),
  },
  {
    accessorKey: "category",
    header: "Category",
    cell: ({ row }) => (
      <Badge variant="outline">{row.getValue("category")}</Badge>
    ),
  },
  {
    accessorKey: "clearanceLevel",
    header: "Clearance",
    cell: ({ row }) => (
      <Badge variant="outline">Level {row.getValue("clearanceLevel")}</Badge>
    ),
  },
  {
    accessorKey: "isActive",
    header: "Status",
    cell: ({ row }) => (
      <Badge variant={row.getValue("isActive") ? "default" : "secondary"}>
        {row.getValue("isActive") ? "Active" : "Inactive"}
      </Badge>
    ),
  },
]

// Example usage component
export function DataTableExample() {
  const exampleData: Equipment[] = [
    {
      id: 1,
      modelName: "Microscope X-2000",
      description: "High-resolution research microscope",
      category: "Laboratory",
      isActive: true,
      clearanceLevel: 2,
    },
    {
      id: 2,
      modelName: "Centrifuge Pro",
      description: "Industrial centrifuge for sample processing",
      category: "Laboratory",
      isActive: true,
      clearanceLevel: 1,
    },
  ]

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold">Equipment List</h2>
      
      {/* Example 1: Basic usage with default mobile cards */}
      <DataTable
        columns={exampleColumns}
        data={exampleData}
        emptyMessage="No equipment found"
      />

      {/* Example 2: With custom mobile card renderer */}
      <DataTable
        columns={exampleColumns}
        data={exampleData}
        emptyMessage="No equipment found"
        renderMobileCard={(equipment) => (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{equipment.modelName}</CardTitle>
              <CardDescription>{equipment.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Category</span>
                <Badge variant="outline">{equipment.category}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Clearance Level</span>
                <Badge variant="outline">Level {equipment.clearanceLevel}</Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant={equipment.isActive ? "default" : "secondary"}>
                  {equipment.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
        onRowClick={(equipment) => {
          console.log("Clicked equipment:", equipment.id)
        }}
      />

      {/* Example 3: Loading state */}
      <DataTable
        columns={exampleColumns}
        data={[]}
        loading={true}
      />

      {/* Example 4: Empty state */}
      <DataTable
        columns={exampleColumns}
        data={[]}
        emptyMessage="No equipment available. Add your first equipment to get started."
      />
    </div>
  )
}

/**
 * Integration Guide:
 * 
 * 1. Import the DataTable component:
 *    import { DataTable } from '@/components/data-table/data-table'
 * 
 * 2. Define your column definitions using @tanstack/react-table:
 *    const columns: ColumnDef<YourDataType>[] = [...]
 * 
 * 3. Use the DataTable component:
 *    <DataTable
 *      columns={columns}
 *      data={data}
 *      renderMobileCard={(item) => <YourCustomCard item={item} />}
 *    />
 * 
 * 4. The table will automatically:
 *    - Show table view on desktop (md breakpoint and above)
 *    - Show card view on mobile (below md breakpoint)
 *    - Display loading skeletons when loading={true}
 *    - Display empty state when data is empty
 * 
 * 5. Customize the mobile card view:
 *    - Provide a renderMobileCard function to customize the card layout
 *    - If not provided, a default card layout will be used
 *    - The default layout shows all columns (except select and actions) as key-value pairs
 * 
 * 6. Responsive Breakpoints:
 *    - Mobile: < 768px (md breakpoint)
 *    - Desktop: >= 768px (md breakpoint)
 *    - Uses Tailwind's md: prefix for responsive classes
 * 
 * 7. Best Practices:
 *    - Keep mobile cards concise and focused on key information
 *    - Use Badge components for status indicators
 *    - Group related information together
 *    - Provide clear visual hierarchy with CardTitle and CardDescription
 *    - Use consistent spacing (space-y-4 for card content)
 */
