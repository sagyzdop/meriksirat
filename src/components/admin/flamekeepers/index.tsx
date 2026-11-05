// PROTOTYPE HOST: three tweaks of the original stacked layout, switchable with
// ?variant=A|B|C. The winning variant gets folded into the real page; the other
// variants and the switcher are deleted afterwards.
import { useNavigate } from '@tanstack/react-router'

import type { PoolOverview } from '@/lib/admin/functions/pool'
import type { FreeSpaceSuggestion } from '@/lib/admin/functions/free-space'
import type { AdminFlamekeeperRow } from '@/lib/flamekeeper/types'
import { PrototypeSwitcher } from './prototype-switcher'
import { VariantA, VariantB, VariantC } from './components/variants'
import type { FlamekeeperTableFilters, FlamekeeperVariant } from './types'

interface PageProps {
  rows: AdminFlamekeeperRow[]
  filters: FlamekeeperTableFilters
  pool?: PoolOverview
  poolLoading: boolean
  suggestions?: FreeSpaceSuggestion[]
  offloadLoading: boolean
  canEditCap: boolean
  canManageOffload: boolean
  canBan: boolean
  viewerId?: string
  isLoading: boolean
}

export function Page(props: PageProps) {
  const navigate = useNavigate()

  const handleVariantChange = (variant: FlamekeeperVariant) => {
    navigate({
      to: '.',
      search: { ...props.filters, variant },
    })
  }

  return (
    <>
      {props.filters.variant === 'A' && <VariantA {...props} />}
      {props.filters.variant === 'B' && <VariantB {...props} />}
      {props.filters.variant === 'C' && <VariantC {...props} />}
      <PrototypeSwitcher
        current={props.filters.variant}
        onChange={handleVariantChange}
      />
    </>
  )
}
