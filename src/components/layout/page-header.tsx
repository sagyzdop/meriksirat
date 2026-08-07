import { ArrowLeft } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  backTo?: string;
  backLabel?: string;
  className?: string;
}

/**
 * PageHeader displays page title, optional description, and action buttons.
 * 
 * Features:
 * - Responsive typography: text-3xl md:text-4xl font-bold for title
 * - Optional description with text-muted-foreground
 * - Actions aligned right on desktop, stacked on mobile
 * - Optional back navigation button rendered above the title
 * - Proper heading hierarchy (h1 for page titles)
 * - Consistent spacing: mb-6 or mb-8
 * 
 * @param title - Page title (required)
 * @param description - Optional page description
 * @param actions - Optional action buttons or elements
 * @param backTo - Optional route to navigate back to; renders a "Back" button above the title
 * @param backLabel - Optional label for the back button (defaults to "Back")
 * @param className - Optional additional CSS classes
 */
export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = "Back",
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
        {backTo && (
          <Button asChild variant="ghost" className="gap-1.5 text-muted-foreground">
            <Link to={backTo}>
              <ArrowLeft className="size-4" aria-hidden="true" />
              {backLabel}
            </Link>
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
  );
}
