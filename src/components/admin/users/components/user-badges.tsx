import { Badge } from '@/components/ui/badge'

const formatRole = (role: string | null | undefined) => {
  if (!role) return '—'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function RoleBadge({ role }: { role: string | null | undefined }) {
  const label = formatRole(role)
  if (label === '—') {
    return <span className="text-muted-foreground">—</span>
  }
  if (role === 'admin') {
    return <Badge variant="destructive">{label}</Badge>
  }
  if (role === 'manager') {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800">
        {label}
      </Badge>
    )
  }
  return <Badge variant="outline">{label}</Badge>
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const value = status || '—'
  if (value === '—') {
    return <span className="text-muted-foreground">—</span>
  }
  if (value === 'Active') {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-800">
        {value}
      </Badge>
    )
  }
  if (value === 'On Probation') {
    return (
      <Badge variant="outline" className="bg-amber-100 text-amber-800">
        {value}
      </Badge>
    )
  }
  return <Badge variant="outline">{value}</Badge>
}
