// src/routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'
import { SectionCards } from '@/components/dashboard/section-cards'
import { ChartAreaInteractive } from '@/components/dashboard/chart-area-interactive'
import { DataTable } from '@/components/dashboard/data-table'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})

// Sample data for DataTable
const sampleData = [
  {
    id: 1,
    header: 'Project Alpha',
    type: 'Development',
    status: 'In Progress',
    target: 'Q1 2024',
    limit: '100k',
    reviewer: 'John Doe',
  },
  {
    id: 2,
    header: 'Project Beta',
    type: 'Design',
    status: 'Completed',
    target: 'Q2 2024',
    limit: '50k',
    reviewer: 'Jane Smith',
  },
  {
    id: 3,
    header: 'Project Gamma',
    type: 'Marketing',
    status: 'Pending',
    target: 'Q3 2024',
    limit: '75k',
    reviewer: 'Bob Johnson',
  },
]

function Dashboard() {
  return (
    <div className="flex-1 space-y-4">
      <SectionCards />
      <ChartAreaInteractive />
      <DataTable data={sampleData} />
    </div>
  )
}
