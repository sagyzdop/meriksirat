import { SectionCards } from './components/section-cards'
import { ChartAreaInteractive } from './components/chart-area-interactive'
import { DataTable } from './components/data-table'

interface DashboardPageProps {
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
    createdAt: Date;
  };
}

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

export function Page({ user }: DashboardPageProps) {
  if (!user) {
    return (
      <div className="container mx-auto space-y-6 px-4 py-10">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground">Please sign in to view your dashboard.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4">
      <SectionCards />
      <ChartAreaInteractive />
      <DataTable data={sampleData} />
    </div>
  );
}