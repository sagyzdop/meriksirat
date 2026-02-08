import { createFileRoute, useRouterState } from '@tanstack/react-router'
import { Page } from "@/components/profile";
import { getUserFn } from '@/lib/user';
import { LoadingOverlay } from '@/components/shared/loading-overlay';

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
  loader: async () => {
    const user = await getUserFn();
    return { 
      user: user || undefined,
    };
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData();
  const isLoading = useRouterState({ select: (state) => state.status === 'pending' })
  return (
    <div className="relative flex-1 space-y-4">
      {isLoading && <LoadingOverlay />}
      <Page user={user} />
    </div>
  )
}