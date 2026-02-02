import { createFileRoute } from '@tanstack/react-router'
import { Page } from '@/components/dashboard/page'
import { getSessionFn } from '@/lib/session'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: RouteComponent,
  loader: async () => {
    const session = await getSessionFn();
    return { user: session?.user };
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData();
  return <Page user={user} />
}
