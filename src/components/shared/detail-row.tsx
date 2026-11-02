import type { ReactNode } from 'react'
import { TableCell, TableRow } from '@/components/ui/table'

interface DetailRowProps {
  label: string
  valueClassName?: string
  children: ReactNode
}

export function DetailRow({ label, valueClassName, children }: DetailRowProps) {
  return (
    <TableRow>
      <TableCell className="pl-3 w-2/5 font-medium text-muted-foreground">
        {label}
      </TableCell>
      <TableCell className={valueClassName}>{children}</TableCell>
    </TableRow>
  )
}
