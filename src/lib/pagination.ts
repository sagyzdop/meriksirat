export interface PaginationMeta {
  page: number
  limit: number
  totalCount: number
  totalPages: number
}

export interface PageInfo {
  page: number
  limit: number
  total: number
  totalPages: number
  hasNext: boolean
  hasPrev: boolean
}

export function buildPagination(
  totalCount: number,
  page: number,
  limit: number
): PaginationMeta {
  return { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) }
}

export function buildPageInfo(
  total: number,
  page: number,
  limit: number
): PageInfo {
  const totalPages = Math.ceil(total / limit)
  return {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  }
}
