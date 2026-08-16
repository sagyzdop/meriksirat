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
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import { Skeleton } from '@/components/ui/skeleton'
import type { AlbumsPerMonthPoint } from '@/lib/admin/dashboard-types'

const chartConfig = {
  public: {
    label: 'Public',
    color: 'hsl(var(--chart-1))',
  },
  private: {
    label: 'Private',
    color: 'hsl(var(--chart-3))',
  },
} satisfies ChartConfig

function formatMonth(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number)
  if (!year || monthIndex === undefined) return month
  const date = new Date(Date.UTC(year, monthIndex - 1, 1))
  const shortMonth = date.toLocaleString('en-US', { month: 'short' })
  const currentYear = new Date().getFullYear()
  return currentYear === year
    ? shortMonth
    : `${shortMonth} '${String(year).slice(2)}`
}

interface AlbumsChartProps {
  data: AlbumsPerMonthPoint[]
  isLoading?: boolean
}

export function AlbumsChart({ data, isLoading = false }: AlbumsChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Albums per Month</CardTitle>
        <CardDescription>
          Albums created in the selected date range, public vs private
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && data.length === 0 ? (
          <Skeleton className="h-[250px] w-full" />
        ) : (
          <ChartContainer config={chartConfig}>
            <BarChart accessibilityLayer data={data}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="month"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={formatMonth}
              />
              <ChartTooltip
                content={<ChartTooltipContent labelFormatter={formatMonth} />}
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="public" fill="var(--color-public)" radius={4} />
              <Bar dataKey="private" fill="var(--color-private)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
