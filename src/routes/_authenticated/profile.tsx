import { createFileRoute } from '@tanstack/react-router'
import { Page } from "@/components/profile";
import { getUserFn } from '@/lib/user';

export const Route = createFileRoute('/_authenticated/profile')({
  component: RouteComponent,
  loader: async () => {
    const user = await getUserFn();
    return { user: user || undefined };
  },
})

function RouteComponent() {
  const { user } = Route.useLoaderData();
  return (
    <div className="flex-1 space-y-4">
        <Page user={user} />
    </div>
  )
}