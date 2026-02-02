import { Link } from '@tanstack/react-router'
import {
  IconUsers,
  IconCamera,
  IconTags,
  IconCalendar,
  IconArrowRight,
} from '@tabler/icons-react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'
import { ContentGrid } from '@/components/layout/content-grid'
import { BookingsChart } from './components/bookings-chart'
import { EquipmentUsageChart } from './components/equipment-usage-chart'

export function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Manage users, equipment, categories, and oversee bookings from this central dashboard."
      />

      <ContentGrid
        columns={{
          mobile: 1,
          tablet: 2,
          desktop: 4,
        }}
        gap={4}
      >
        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/users" className="block">
            <CardHeader>
              <CardTitle>User Management</CardTitle>
              <CardDescription>
                Manage user accounts, roles, and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <IconUsers className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/equipment" className="block">
            <CardHeader>
              <CardTitle>Equipment Management</CardTitle>
              <CardDescription>
                Add, edit, and manage equipment catalog
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
                  <IconCamera className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/categories" className="block">
            <CardHeader>
              <CardTitle>Category Management</CardTitle>
              <CardDescription>
                Organize equipment into categories
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <IconTags className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/bookings" className="block">
            <CardHeader>
              <CardTitle>Booking Oversight</CardTitle>
              <CardDescription>
                Monitor and manage all equipment bookings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
                  <IconCalendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <IconArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
            </CardContent>
          </Link>
        </Card>
      </ContentGrid>

      <Section title="Quick Actions" spacing="default">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/admin/users">
              <IconUsers className="mr-2 h-4 w-4" />
              View All Users
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/admin/equipment/new">
              <IconCamera className="mr-2 h-4 w-4" />
              Add Equipment
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/admin/bookings">
              <IconCalendar className="mr-2 h-4 w-4" />
              View All Bookings
            </Link>
          </Button>
        </div>
      </Section>

      <Section title="Analytics" spacing="default">
        <div className="grid gap-6 md:grid-cols-2">
          <BookingsChart />
          <EquipmentUsageChart />
        </div>
      </Section>
    </PageContainer>
  )
}
