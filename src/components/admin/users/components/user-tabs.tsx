import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'

const tabClass =
  'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors'

export function UserTabs({
  active,
}: {
  active: 'members' | 'flamekeepers' | 'alumni'
}) {
  return (
    <nav
      aria-label="User groups"
      className="mb-6 inline-flex gap-1 rounded-lg bg-muted p-1"
    >
      <Link
        to="/admin/users"
        className={cn(
          tabClass,
          active === 'members'
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Members
      </Link>
      <Link
        to="/admin/flamekeepers"
        className={cn(
          tabClass,
          active === 'flamekeepers'
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Flamekeepers
      </Link>
      <Link
        to="/admin/alumni"
        className={cn(
          tabClass,
          active === 'alumni'
            ? 'bg-background shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        )}
      >
        Alumni
      </Link>
    </nav>
  )
}
