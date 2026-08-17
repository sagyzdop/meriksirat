import { cn } from '@/lib/utils'

export interface SectionProps {
  children: React.ReactNode
  title?: string
  description?: string
  actions?: React.ReactNode
  className?: string
  spacing?: 'default' | 'compact' | 'spacious'
}

/**
 * Section provides consistent vertical spacing between page sections.
 *
 * Features:
 * - Optional section header with h2 title (text-2xl font-semibold)
 * - Configurable spacing variants: 'default' (space-y-8), 'compact' (space-y-6), 'spacious' (space-y-12)
 * - Optional actions slot in section header
 * - Proper heading hierarchy (h2 for section headings)
 *
 * @param children - Content to be rendered inside the section
 * @param title - Optional section title
 * @param description - Optional section description
 * @param actions - Optional action buttons or elements
 * @param className - Optional additional CSS classes
 * @param spacing - Spacing variant: 'default' (space-y-8), 'compact' (space-y-6), 'spacious' (space-y-12)
 */
export function Section({
  children,
  title,
  description,
  actions,
  className,
  spacing = 'default',
}: SectionProps) {
  const spacingClasses = {
    default: 'space-y-8',
    compact: 'space-y-6',
    spacious: 'space-y-12',
  }

  return (
    <section className={cn(spacingClasses[spacing], className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {title && <h2 className="text-2xl font-semibold">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}
