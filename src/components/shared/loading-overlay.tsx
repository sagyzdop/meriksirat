import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

interface LoadingOverlayProps {
  className?: string
  label?: string
}

export function LoadingOverlay({ className, label = "Loading..." }: LoadingOverlayProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex items-center justify-center bg-background/70 backdrop-blur-sm",
        className
      )}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="h-4 w-4" />
        <span>{label}</span>
      </div>
    </div>
  )
}
