import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const attachmentVariants = cva(
  "relative flex items-center gap-3 rounded-lg border bg-background transition-colors",
  {
    variants: {
      orientation: {
        horizontal: "flex-row",
        vertical: "flex-col items-stretch",
      },
      size: {
        default: "min-w-52 max-w-72 p-3",
        sm: "min-w-40 max-w-64 p-2.5",
        xs: "min-w-32 max-w-52 p-2",
      },
    },
    defaultVariants: {
      orientation: "horizontal",
      size: "default",
    },
  }
)

type AttachmentState = "idle" | "uploading" | "processing" | "error" | "done"

interface AttachmentProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof attachmentVariants> {
  state?: AttachmentState
}

function Attachment({
  className,
  orientation,
  size,
  state = "done",
  ...props
}: AttachmentProps) {
  return (
    <div
      data-slot="attachment"
      data-state={state}
      className={cn(
        attachmentVariants({ orientation, size }),
        state === "error" && "border-destructive/50",
        className
      )}
      {...props}
    />
  )
}

const attachmentMediaVariants = cva(
  "bg-muted flex shrink-0 items-center justify-center text-muted-foreground",
  {
    variants: {
      variant: {
        icon: "size-10 rounded-md",
        image: "h-auto w-full overflow-hidden rounded-md",
      },
    },
    defaultVariants: {
      variant: "icon",
    },
  }
)

function AttachmentMedia({
  className,
  variant = "icon",
  ...props
}: React.ComponentProps<"div"> & { variant?: "icon" | "image" }) {
  return (
    <div
      data-slot="attachment-media"
      className={cn(attachmentMediaVariants({ variant }), className)}
      {...props}
    />
  )
}

function AttachmentContent({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-content"
      className={cn("flex min-w-0 flex-1 flex-col gap-1", className)}
      {...props}
    />
  )
}

function AttachmentTitle({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="attachment-title"
      className={cn("truncate text-sm font-medium", className)}
      {...props}
    />
  )
}

function AttachmentDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="attachment-description"
      className={cn(
        "truncate text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  )
}

function AttachmentActions({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-actions"
      className={cn(
        "flex shrink-0 items-center gap-1",
        className
      )}
      {...props}
    />
  )
}

function AttachmentAction({
  className,
  size = "icon-xs",
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      data-slot="attachment-action"
      variant="ghost"
      size={size}
      className={cn("text-muted-foreground", className)}
      {...props}
    />
  )
}

function AttachmentTrigger({
  className,
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button"
  return (
    <Comp
      data-slot="attachment-trigger"
      className={cn(
        "absolute inset-0 z-0 rounded-lg outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        className
      )}
      {...props}
    />
  )
}

function AttachmentGroup({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="attachment-group"
      className={cn(
        "no-scrollbar flex snap-x snap-mandatory items-stretch gap-2 overflow-x-auto overscroll-x-contain",
        className
      )}
      {...props}
    />
  )
}

function AttachmentShimmer({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden="true"
      className={cn("animate-pulse rounded-full bg-current opacity-20", className)}
      {...props}
    />
  )
}

export {
  Attachment,
  AttachmentAction,
  AttachmentActions,
  AttachmentContent,
  AttachmentDescription,
  AttachmentGroup,
  AttachmentMedia,
  AttachmentShimmer,
  AttachmentTitle,
  AttachmentTrigger,
  attachmentVariants,
}
