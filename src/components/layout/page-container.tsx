import { cn } from '@/lib/utils'

export interface PageContainerProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'default' | 'wide' | 'full'
}

/**
 * PageContainer provides consistent width and padding for all page content.
 *
 * Features:
 * - Responsive padding: px-4 (mobile), px-6 (tablet), px-8 (desktop)
 * - Configurable max-width variants
 * - Centered layout with mx-auto
 *
 * @param children - Content to be rendered inside the container
 * @param className - Optional additional CSS classes
 * @param maxWidth - Maximum width variant: 'default' (max-w-7xl), 'wide' (max-w-full), 'full' (no max)
 */
export function PageContainer({
  children,
  className,
  maxWidth = 'default',
}: PageContainerProps) {
  const maxWidthClasses = {
    default: 'max-w-7xl',
    wide: 'max-w-full',
    full: '',
  }

  return (
    <div
      className={cn(
        'container mx-auto flex flex-col min-w-0 w-full',
        'px-4 py-8 md:px-6 lg:px-8',
        maxWidthClasses[maxWidth],
        className
      )}
    >
      {children}
    </div>
  )
}
