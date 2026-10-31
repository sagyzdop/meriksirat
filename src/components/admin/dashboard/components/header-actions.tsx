import * as React from 'react'
import { Link } from '@tanstack/react-router'
import {
  Bell,
  Camera,
  Calendar,
  ChevronDown,
  Download,
  Mail,
  Megaphone,
  Users,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ExportUsersDialog } from '@/components/shared/export-users-dialog'
import { BroadcastDialog } from '@/components/shared/broadcast-dialog'
import { sendTestEmailFn } from '@/lib/admin/functions/test-email'
import { DashboardAlerts } from './dashboard-alerts'
import type { DashboardAlert } from '@/lib/admin/dashboard-types'

interface DashboardHeaderActionsProps {
  alerts: DashboardAlert[]
  alertsLoading: boolean
  canBroadcast: boolean
}

export function DashboardHeaderActions({
  alerts,
  alertsLoading,
  canBroadcast,
}: DashboardHeaderActionsProps) {
  const [exportOpen, setExportOpen] = React.useState(false)
  const [broadcastOpen, setBroadcastOpen] = React.useState(false)
  const [isSendingTestEmail, setIsSendingTestEmail] = React.useState(false)

  const handleSendTestEmail = async () => {
    setIsSendingTestEmail(true)
    try {
      const { sentTo } = await sendTestEmailFn()
      toast.success(`Test email sent to ${sentTo}`)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to send test email'
      )
    } finally {
      setIsSendingTestEmail(false)
    }
  }

  return (
    <>
      {canBroadcast && (
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          disabled={isSendingTestEmail}
          onClick={handleSendTestEmail}
        >
          <Mail className="mr-2 h-4 w-4" />
          {isSendingTestEmail ? 'Sending...' : 'Send test email'}
        </Button>
      )}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="relative h-8">
            <Bell className="mr-2 h-4 w-4" />
            Alerts
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2 px-1.5">
                {alerts.length}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="max-h-80 w-96 overflow-y-auto">
          <DashboardAlerts alerts={alerts} isLoading={alertsLoading} />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8">
            Quick Actions
            <ChevronDown className="ml-2 h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/admin/users">
              <Users />
              View All Users
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/admin/equipment/new">
              <Camera />
              Add Equipment
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/admin/bookings">
              <Calendar />
              View All Bookings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setExportOpen(true)}>
            <Download />
            Export Users
          </DropdownMenuItem>
          {canBroadcast && (
            <DropdownMenuItem onSelect={() => setBroadcastOpen(true)}>
              <Megaphone />
              Broadcast Message
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ExportUsersDialog open={exportOpen} onOpenChange={setExportOpen} />
      {canBroadcast && (
        <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />
      )}
    </>
  )
}
