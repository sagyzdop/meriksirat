import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import type { QueryClient } from '@tanstack/react-query'
import { ThemeProvider } from 'next-themes'

import appCss from '@/styles.css?url'
import { Snowfall } from '@/components/shared/snowfall'
import { HalloweenDecorations } from '@/components/shared/halloween'

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient
}>()({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'NU Image',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  notFoundComponent: () => {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-4xl font-bold mb-4">404 - Page Not Found</h1>
        <p className="text-gray-600 mb-4">
          The page you're looking for doesn't exist.
        </p>
        <a href="/" className="text-blue-600 hover:underline">
          Go back home
        </a>
      </div>
    )
  },

  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  const enableDevtools = import.meta.env.VITE_ENABLE_DEVTOOLS === 'true'

  return (
    // next-themes' blocking script writes the theme class onto <html> before
    // hydration, so React must not warn about the resulting attribute mismatch.
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body
        // halloween.js: master switch + effects. It no-ops outside the window
        // below, so these stay on all year.
        className="halloween halloween-eyes halloween-witches halloween-spider-drop halloween-tombstones halloween-screen-left-top halloween-intensity-subtle"
        data-halloween-start="01-10"
        data-halloween-end="11-11"
        // Same DD-MM convention for snowfall.tsx. Wraps the year boundary.
        data-snow-start="01-12"
        data-snow-end="28-02"
      >
        {/* attribute="class" matches the `.dark` custom-variant in styles.css.
            Placed in the SSR'd shell so next-themes' blocking script lands in
            the initial HTML — no flash of the wrong theme. */}
        <ThemeProvider attribute="class">{children}</ThemeProvider>
        <HalloweenDecorations />
        <Snowfall />
        {enableDevtools && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
