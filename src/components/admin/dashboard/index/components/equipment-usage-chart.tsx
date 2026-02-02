import { Pie, PieChart, Cell, Legend } from 'recharts'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart'

// Sample data - in a real app, this would come from props or API
const chartData = [
  { category: 'cameras', count: 45, fill: 'var(--color-cameras)' },
  { category: 'lenses', count: 32, fill: 'var(--color-lenses)' },
  { category: 'lighting', count: 28, fill: 'var(--color-lighting)' },
  { category: 'audio', count: 22, fill: 'var(--color-audio)' },
  { category: 'accessories', count: 18, fill: 'var(--color-accessories)' },
]

const chartConfig = {
  count: {
    label: 'Equipment Count',
  },
  cameras: {
    label: 'Cameras',
    color: 'hsl(var(--chart-1))',
  },
  lenses: {
    label: 'Lenses',
    color: 'hsl(var(--chart-2))',
  },
  lighting: {
    label: 'Lighting',
    color: 'hsl(var(--chart-3))',
  },
  audio: {
    label: 'Audio',
    color: 'hsl(var(--chart-4))',
  },
  accessories: {
    label: 'Accessories',
    color: 'hsl(var(--chart-5))',
  },
} satisfies ChartConfig

export function EquipmentUsageChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Equipment Distribution</CardTitle>
        <CardDescription>
          Equipment count by category across the inventory
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <PieChart>
            <ChartTooltip
              content={<ChartTooltipContent nameKey="category" hideLabel />}
            />
            <Pie
              data={chartData}
              dataKey="count"
              nameKey="category"
              cx="50%"
              cy="50%"
              outerRadius={80}
              label
            />
            <ChartLegend content={<ChartLegendContent nameKey="category" />} />
          </PieChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
