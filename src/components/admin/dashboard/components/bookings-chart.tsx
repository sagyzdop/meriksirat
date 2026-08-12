import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
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
  { month: 'January', pending: 12, approved: 45, completed: 38 },
  { month: 'February', pending: 15, approved: 52, completed: 42 },
  { month: 'March', pending: 18, approved: 48, completed: 51 },
  { month: 'April', pending: 10, approved: 55, completed: 47 },
  { month: 'May', pending: 14, approved: 60, completed: 53 },
  { month: 'June', pending: 16, approved: 58, completed: 49 },
]

const chartConfig = {
  pending: {
    label: 'Pending',
    color: 'hsl(var(--chart-1))',
  },
  approved: {
    label: 'Approved',
    color: 'hsl(var(--chart-2))',
  },
  completed: {
    label: 'Completed',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig

export function BookingsChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Bookings Overview</CardTitle>
        <CardDescription>
          Monthly booking status distribution for the last 6 months
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <BarChart accessibilityLayer data={chartData}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value) => value.slice(0, 3)}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <ChartLegend content={<ChartLegendContent />} />
            <Bar dataKey="pending" fill="var(--color-pending)" radius={4} />
            <Bar dataKey="approved" fill="var(--color-approved)" radius={4} />
            <Bar dataKey="completed" fill="var(--color-completed)" radius={4} />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
