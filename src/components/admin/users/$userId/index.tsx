import { PageContainer } from "@/components/layout/page-container"
import { PageHeader } from "@/components/layout/page-header"
import { Section } from "@/components/layout/section"
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table"

const formatDate = (value: string | number | null | undefined) => {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
}

const formatRole = (role: string | null | undefined) => {
  if (!role) return '—'
  return role.charAt(0).toUpperCase() + role.slice(1)
}

interface PageProps {
  user: any
}

export function Page({ user }: PageProps) {
  return (
    <PageContainer>
      <PageHeader
        title="User Details"
        backTo="/admin/users"
        backLabel="Back to Users"
      />
      <Section spacing="compact">
        <div className="relative rounded-md border overflow-x-auto">
          <Table>
            <TableBody>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Name</TableCell>
                <TableCell>{`${user.firstName || ''} ${user.lastName || ''}`.trim() || '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Email</TableCell>
                <TableCell className="break-all">{user.email}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Role</TableCell>
                <TableCell>{formatRole(user.role)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Clearance Level</TableCell>
                <TableCell>{user.clearanceLevel ? `Level ${user.clearanceLevel}` : '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Status</TableCell>
                <TableCell>{user.status || '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Instagram</TableCell>
                <TableCell>{user.instagramUsername || '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">NU ID</TableCell>
                <TableCell>{user.nuId ?? '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Birthday</TableCell>
                <TableCell>{formatDate(user.birthday)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Major</TableCell>
                <TableCell>{user.major || '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Graduation Year</TableCell>
                <TableCell>{user.graduationYear ?? '—'}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">Member Since</TableCell>
                <TableCell>{formatDate(user.createdAt)}</TableCell>
              </TableRow>
              <TableRow>
                <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">User ID</TableCell>
                <TableCell className="whitespace-nowrap">{user.id}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </Section>
    </PageContainer>
  )
}
