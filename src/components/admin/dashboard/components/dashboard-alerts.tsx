import { Link } from '@tanstack/react-router'
import {
  AlertTriangle,
  Bell,
  Info,
  ShieldAlert,
  type LucideIcon,
} from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DashboardAlert } from '@/lib/admin/dashboard-types'
import { cn } from '@/lib/utils'

const severityConfig: Record<
  DashboardAlert['severity'],
  { icon: LucideIcon; className: string; titleClass: string }
> = {
  info: {
    icon: Info,
    className:
      'border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/40 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
    titleClass: 'text-blue-900 dark:text-blue-100',
  },
  warning: {
    icon: AlertTriangle,
    className:
      'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 [&>svg]:text-amber-600 dark:[&>svg]:text-amber-400',
    titleClass: 'text-amber-900 dark:text-amber-100',
  },
  danger: {
    icon: ShieldAlert,
    className:
      'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 [&>svg]:text-red-600 dark:[&>svg]:text-red-400',
    titleClass: 'text-red-900 dark:text-red-100',
  },
}

interface DashboardAlertsProps {
  alerts: DashboardAlert[]
  isLoading?: boolean
}

export function DashboardAlerts({
  alerts,
  isLoading = false,
}: DashboardAlertsProps) {
  if (isLoading && alerts.length === 0) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="flex items-start gap-3 rounded-lg border p-4">
            <Skeleton className="mt-0.5 h-4 w-4 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
        <Bell className="h-4 w-4" />
        All clear — no active alerts.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => {
        const config = severityConfig[alert.severity]
        const Icon = config.icon
        return (
          <Alert key={alert.id} className={cn(config.className)}>
            <Icon />
            <AlertTitle className={config.titleClass}>{alert.title}</AlertTitle>
            <AlertDescription>
              <span>{alert.message}</span>
              {alert.href && (
                <Button asChild variant="link" size="sm" className="h-auto p-0">
                  <Link to={alert.href as never}>View</Link>
                </Button>
              )}
            </AlertDescription>
          </Alert>
        )
      })}
    </div>
  )
}
