import { queryOptions } from '@tanstack/react-query'
import {
  getEquipmentFn,
  getAdminEquipmentFn,
  getCategoriesFn,
} from './functions'
import type { EquipmentFilters, PaginatedEquipmentResponse } from './types'

export function equipmentEmptyResponse(
  filters: EquipmentFilters
): PaginatedEquipmentResponse {
  return {
    data: [],
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total: 0,
      totalPages: 0,
      hasNext: false,
      hasPrev: false,
    },
  }
}

export const equipmentQueries = {
  all: ['equipment'] as const,
  lists: () => ['equipment', 'list'] as const,
  adminLists: () => ['equipment', 'admin-list'] as const,
  list: (filters: EquipmentFilters) =>
    queryOptions({
      queryKey: [...equipmentQueries.lists(), filters],
      queryFn: async (): Promise<PaginatedEquipmentResponse> =>
        (await getEquipmentFn({ data: filters })) ??
        equipmentEmptyResponse(filters),
    }),
  adminList: (filters: EquipmentFilters) =>
    queryOptions({
      queryKey: [...equipmentQueries.adminLists(), filters],
      queryFn: async (): Promise<PaginatedEquipmentResponse> =>
        (await getAdminEquipmentFn({ data: filters })) ??
        equipmentEmptyResponse(filters),
    }),
  categories: () =>
    queryOptions({
      queryKey: ['categories'],
      queryFn: () => getCategoriesFn(),
    }),
}
