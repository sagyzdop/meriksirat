import { Outlet, createFileRoute, useRouterState } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { ExportAlbumsDialog } from '@/components/shared/export-albums-dialog'

export const Route = createFileRoute('/_authenticated/admin/albums')({
  component: RouteComponent,
})

function RouteComponent() {
  const isDetail = useRouterState({
    select: (state) =>
      state.matches.some(
        (match) => match.routeId === '/_authenticated/admin/albums/$albumId'
      ),
  })

  return (
    <PageContainer>
      {!isDetail && (
        <PageHeader title="Manage Albums" actions={<ExportAlbumsDialog />} />
      )}
      <Outlet />
    </PageContainer>
  )
}
