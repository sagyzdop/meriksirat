
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"

interface EquipmentPaginationProps {
    page: number
    limit: number
    total: number
    totalPages: number
    onPageChange: (page: number) => void
    onLimitChange: (limit: number) => void
}

export function EquipmentPagination({
    page,
    limit,
    total,
    totalPages,
    onPageChange,
    onLimitChange,
}: EquipmentPaginationProps) {
    return (
        <div className="flex flex-col gap-4 px-2 sm:flex-row sm:items-center sm:justify-between py-4">
            <div className="text-sm text-muted-foreground">
                Total {total} items
            </div>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:space-x-6 lg:space-x-8">
                <div className="flex items-center space-x-2">
                    <p className="text-sm font-medium whitespace-nowrap">Rows per page</p>
                    <Select
                        value={`${limit}`}
                        onValueChange={(value) => onLimitChange(Number(value))}
                    >
                        <SelectTrigger className="h-8 w-17.5">
                            <SelectValue placeholder={limit} />
                        </SelectTrigger>
                        <SelectContent side="top">
                            {[10, 20, 30, 40, 50].map((pageSize) => (
                                <SelectItem key={pageSize} value={`${pageSize}`}>
                                    {pageSize}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex items-center justify-between sm:justify-center gap-2">
                    <div className="flex w-25 items-center justify-center text-sm font-medium">
                        Page {page} of {totalPages}
                    </div>
                    <div className="flex items-center space-x-2">
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => onPageChange(1)}
                            disabled={page <= 1}
                        >
                            <span className="sr-only">Go to first page</span>
                            <ChevronsLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => onPageChange(page - 1)}
                            disabled={page <= 1}
                        >
                            <span className="sr-only">Go to previous page</span>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                        >
                            <span className="sr-only">Go to next page</span>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                        <Button
                            variant="outline"
                            className="hidden h-8 w-8 p-0 lg:flex"
                            onClick={() => onPageChange(totalPages)}
                            disabled={page >= totalPages}
                        >
                            <span className="sr-only">Go to last page</span>
                            <ChevronsRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
