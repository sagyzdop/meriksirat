import { queryOptions } from '@tanstack/react-query'
import {
  getEquipmentFn,
  getAdminEquipmentFn,
  getCategoriesFn,
  getEquipmentByIdFn,
} from './functions'
import type {
  AdminEquipmentFilters,
  EquipmentFilters,
  EquipmentResponse,
  PaginatedEquipmentResponse,
} from './types'

export function equipmentEmptyResponse(): EquipmentResponse {
  return { data: [] }
}

export function adminEquipmentEmptyResponse(
  filters: AdminEquipmentFilters
): PaginatedEquipmentResponse {
  return {
    data: [],
    pagination: {
      page: filters.page ?? 1,
      limit: filters.limit ?? 50,
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
  list: (filters: EquipmentFilters = {}) =>
    queryOptions({
      queryKey: [...equipmentQueries.lists(), filters],
      staleTime: 60_000,
      queryFn: async (): Promise<EquipmentResponse> =>
        (await getEquipmentFn({ data: filters })) ?? equipmentEmptyResponse(),
    }),
  adminList: (filters: AdminEquipmentFilters) =>
    queryOptions({
      queryKey: [...equipmentQueries.adminLists(), filters],
      queryFn: async (): Promise<PaginatedEquipmentResponse> =>
        (await getAdminEquipmentFn({ data: filters })) ??
        adminEquipmentEmptyResponse(filters),
    }),
  detail: (equipmentId: number) =>
    queryOptions({
      queryKey: ['equipment', 'detail', equipmentId],
      queryFn: () => getEquipmentByIdFn({ data: { equipmentId } }),
    }),
  categories: () =>
    queryOptions({
      queryKey: ['categories'],
      queryFn: () => getCategoriesFn(),
    }),
}
