import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export interface PageHeaderProps {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  onBack?: () => void
  className?: string
}

export function PageHeader({
  title,
  description,
  actions,
  onBack,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 md:flex-row md:items-start md:justify-between',
        'mb-6 md:mb-8',
        className
      )}
    >
      <div className="min-w-0 space-y-3">
        {onBack && (
          <Button
            variant="ghost"
            className="gap-1.5 text-muted-foreground"
            onClick={onBack}
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back
          </Button>
        )}
        <div className="space-y-1">
          <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground md:text-base">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {actions}
        </div>
      )}
    </div>
  )
}
