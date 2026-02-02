import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * PageHeader displays page title, optional description, and action buttons.
 * 
 * Features:
 * - Responsive typography: text-3xl md:text-4xl font-bold for title
 * - Optional description with text-muted-foreground
 * - Actions aligned right on desktop, stacked on mobile
 * - Proper heading hierarchy (h1 for page titles)
 * - Consistent spacing: mb-6 or mb-8
 * 
 * @param title - Page title (required)
 * @param description - Optional page description
 * @param actions - Optional action buttons or elements
 * @param className - Optional additional CSS classes
 */
export function PageHeader({
  title,
  description,
  actions,
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
      <div className="space-y-1">
        <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground md:text-base">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          {actions}
        </div>
      )}
    </div>
  );
}
