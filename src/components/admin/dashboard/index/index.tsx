import { Link } from '@tanstack/react-router'
import { Users, Camera, Tags, Calendar, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { BookingsChart } from './components/bookings-chart'
import { EquipmentUsageChart } from './components/equipment-usage-chart'

export function Page() {
  return (
    <PageContainer>
      <PageHeader
        title="Dashboard"
        description="Manage users, equipment, categories, and oversee bookings"
      />

      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <Link to="/admin/users" className="block">
              <CardHeader>
                <CardTitle>Users</CardTitle>
                <CardDescription>
                  Manage accounts and permissions
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <Link to="/admin/equipment" className="block">
              <CardHeader>
                <CardTitle>Equipment</CardTitle>
                <CardDescription>
                  Manage equipment catalog
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
                    <Camera className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <Link to="/admin/categories" className="block">
              <CardHeader>
                <CardTitle>Categories</CardTitle>
                <CardDescription>
                  Organize equipment
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
                    <Tags className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="group cursor-pointer transition-all hover:shadow-md">
            <Link to="/admin/bookings" className="block">
              <CardHeader>
                <CardTitle>Bookings</CardTitle>
                <CardDescription>
                  Monitor all bookings
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
                    <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <BookingsChart />
          <EquipmentUsageChart />
        </div>
      </div>
    </PageContainer>
  )
}
