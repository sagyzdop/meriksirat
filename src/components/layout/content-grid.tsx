import { cn } from '@/lib/utils';

export interface ContentGridProps {
  children: React.ReactNode;
  columns?: {
    mobile?: 1;
    tablet?: 2;
    desktop?: 3 | 4;
  };
  gap?: 4 | 6 | 8;
  className?: string;
}

/**
 * ContentGrid provides responsive grid layout for cards and content items.
 * 
 * Features:
 * - Responsive CSS Grid with configurable columns
 * - Default: grid-cols-1 md:grid-cols-2 lg:grid-cols-3
 * - Configurable gap spacing: 4 (16px), 6 (24px), 8 (32px)
 * - Mobile-first responsive design
 * 
 * @param children - Content items to be rendered in the grid
 * @param columns - Column configuration for different breakpoints
 * @param gap - Gap spacing between grid items (4, 6, or 8)
 * @param className - Optional additional CSS classes
 */
export function ContentGrid({
  children,
  columns = {
    mobile: 1,
    tablet: 2,
    desktop: 3,
  },
  gap = 4,
  className,
}: ContentGridProps) {
  const gapClasses = {
    4: 'gap-4',
    6: 'gap-6',
    8: 'gap-8',
  };

  const columnClasses = {
    mobile: {
      1: 'grid-cols-1',
    },
    tablet: {
      2: 'md:grid-cols-2',
    },
    desktop: {
      3: 'lg:grid-cols-3',
      4: 'lg:grid-cols-4',
    },
  };

  return (
    <div
      className={cn(
        'grid',
        columnClasses.mobile[columns.mobile || 1],
        columnClasses.tablet[columns.tablet || 2],
        columnClasses.desktop[columns.desktop || 3],
        gapClasses[gap],
        className
      )}
    >
      {children}
    </div>
  );
}
