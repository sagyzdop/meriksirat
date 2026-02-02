import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Settings, Database, Calendar, Bell, Shield, Users } from 'lucide-react'

export function Page() {
  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Manage system settings and configurations
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Database
            </CardTitle>
            <CardDescription>
              Database connection and configuration
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Database Type</p>
                <p className="text-sm text-muted-foreground">Cloudflare D1</p>
              </div>
              <Badge variant="outline">Connected</Badge>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">Database Name</p>
              <p className="text-sm text-muted-foreground font-mono">meriksirat_d1</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Google Calendar Integration
            </CardTitle>
            <CardDescription>
              Calendar synchronization settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Integration Status</p>
                <p className="text-sm text-muted-foreground">Google Calendar API</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">Sync Mode</p>
              <p className="text-sm text-muted-foreground">Real-time synchronization</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Service Account</p>
              <p className="text-sm text-muted-foreground">Configured</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Telegram Bot
            </CardTitle>
            <CardDescription>
              Telegram bot integration and notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Bot Status</p>
                <p className="text-sm text-muted-foreground">Telegram Bot API</p>
              </div>
              <Badge variant="default">Active</Badge>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">Features</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">Booking Management</Badge>
                <Badge variant="secondary">Equipment Return</Badge>
                <Badge variant="secondary">Photo Upload</Badge>
                <Badge variant="secondary">Notifications</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Authentication
            </CardTitle>
            <CardDescription>
              User authentication and authorization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Auth Provider</p>
                <p className="text-sm text-muted-foreground">Better Auth</p>
              </div>
              <Badge variant="outline">Configured</Badge>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">Session Management</p>
              <p className="text-sm text-muted-foreground">Cookie-based sessions</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Role-Based Access</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">User</Badge>
                <Badge variant="secondary">Manager</Badge>
                <Badge variant="secondary">Admin</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              User Management
            </CardTitle>
            <CardDescription>
              User clearance and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Clearance Levels</p>
              <p className="text-sm text-muted-foreground">1-10 (configurable per equipment)</p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">User Statuses</p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="secondary">Active</Badge>
                <Badge variant="secondary">Inactive</Badge>
                <Badge variant="secondary">On Probation</Badge>
                <Badge variant="secondary">Board</Badge>
                <Badge variant="secondary">Graduated</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              System Information
            </CardTitle>
            <CardDescription>
              Application version and environment
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm font-medium">Platform</p>
              <p className="text-sm text-muted-foreground">Cloudflare Workers</p>
            </div>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium">Framework</p>
              <p className="text-sm text-muted-foreground">TanStack Start + React</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm font-medium">Storage</p>
              <p className="text-sm text-muted-foreground">Cloudflare R2 (Images)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>About This System</CardTitle>
          <CardDescription>
            Equipment booking and management system
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This system provides a comprehensive solution for managing equipment bookings with integrated 
            Google Calendar synchronization, Telegram bot notifications, and role-based access control.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="space-y-1">
              <p className="text-2xl font-bold">Real-time</p>
              <p className="text-sm text-muted-foreground">Calendar Sync</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">Multi-role</p>
              <p className="text-sm text-muted-foreground">Access Control</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">Automated</p>
              <p className="text-sm text-muted-foreground">Notifications</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
