import {
  Aperture,
  Battery,
  Camera,
  HardDrive,
  Lightbulb,
  Package,
  Zap,
  type LucideIcon,
} from 'lucide-react'

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  'camera bodies': Camera,
  lenses: Aperture,
  lighting: Lightbulb,
  triggers: Zap,
  storage: HardDrive,
  batteries: Battery,
}

export function getCategoryIcon(name: string): LucideIcon {
  return CATEGORY_ICONS[name.trim().toLowerCase()] ?? Package
}
