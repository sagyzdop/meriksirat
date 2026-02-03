import { Link } from '@tanstack/react-router'
import {
  Users,
  Camera,
  Tags,
  Calendar,
  ArrowRight,
} from 'lucide-react'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function Page() {
  return (
    <div className="flex-1 space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-1 mb-6 md:mb-8">
        <h1 className="text-3xl font-bold md:text-4xl">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground md:text-base">
          Manage users, equipment, categories, and oversee bookings from this central dashboard.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/users" className="block">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-lg">User Management</CardTitle>
                <CardDescription>
                  Manage user accounts, roles, and permissions
                </CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/equipment" className="block">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
                  <Camera className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-lg">Equipment Management</CardTitle>
                <CardDescription>
                  Add, edit, and manage equipment catalog
                </CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/categories" className="block">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/20">
                  <Tags className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-lg">Category Management</CardTitle>
                <CardDescription>
                  Organize equipment into categories
                </CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>

        <Card className="group cursor-pointer transition-all hover:shadow-md">
          <Link to="/admin/bookings" className="block">
            <CardHeader className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/20">
                  <Calendar className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-lg">Booking Oversight</CardTitle>
                <CardDescription>
                  Monitor and manage all equipment bookings
                </CardDescription>
              </div>
            </CardHeader>
          </Link>
        </Card>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-semibold">Quick Actions</h2>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/admin/users">
              <Users className="mr-2 h-4 w-4" />
              View All Users
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/admin/equipment/new">
              <Camera className="mr-2 h-4 w-4" />
              Add Equipment
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto">
            <Link to="/admin/bookings">
              <Calendar className="mr-2 h-4 w-4" />
              View All Bookings
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
