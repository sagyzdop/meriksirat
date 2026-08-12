import { GalleryVerticalEnd } from 'lucide-react'
import { FieldDescription } from '@/components/ui/field'

interface OnboardingHeaderProps {
  title: string
  description: string
}

export function OnboardingHeader({
  title,
  description,
}: OnboardingHeaderProps) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <a href="#" className="flex flex-col items-center gap-2 font-medium">
        <div className="flex size-8 items-center justify-center rounded-md">
          <GalleryVerticalEnd className="size-6" />
        </div>
        <span className="sr-only">MerikSirat</span>
      </a>
      <h1 className="text-xl font-bold">{title}</h1>
      <FieldDescription>{description}</FieldDescription>
    </div>
  )
}
