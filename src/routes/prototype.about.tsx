// PROTOTYPE: three public About page layouts.
import { createFileRoute, notFound, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import {
  VariantA,
  VariantB,
  VariantC,
  VariantD,
} from '@/components/prototype/about-variants'
import { PrototypeSwitcher } from '@/components/prototype/prototype-switcher'

const VARIANTS = [
  { key: 'A', name: 'Short essay' },
  { key: 'B', name: 'Reference with side nav' },
  { key: 'C', name: 'Dark flame hero' },
  { key: 'D', name: 'A header, B sections, no side nav' },
]

export const Route = createFileRoute('/prototype/about')({
  ssr: false,
  validateSearch: z.object({
    variant: z.enum(['A', 'B', 'C', 'D']).catch('D'),
  }),
  beforeLoad: () => {
    if (import.meta.env.VITE_ENABLE_DEVTOOLS !== 'true') throw notFound()
  },
  component: RouteComponent,
})

function RouteComponent() {
  const { variant } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <>
      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && <VariantC />}
      {variant === 'D' && <VariantD />}
      <PrototypeSwitcher
        variants={VARIANTS}
        current={variant}
        onVariant={(key) =>
          navigate({
            search: { variant: key as 'A' | 'B' | 'C' | 'D' },
            replace: true,
          })
        }
      />
    </>
  )
}
