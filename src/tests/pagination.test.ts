import { describe, expect, it } from 'vitest'
import { buildPageInfo, buildPagination } from '@/lib/pagination'

describe('buildPagination', () => {
  it('rounds the page count up', () => {
    expect(buildPagination(101, 2, 50)).toEqual({
      page: 2,
      limit: 50,
      totalCount: 101,
      totalPages: 3,
    })
  })
  it('has zero pages when empty', () => {
    expect(buildPagination(0, 1, 50).totalPages).toBe(0)
  })
})

describe('buildPageInfo', () => {
  it('flags neighbouring pages', () => {
    expect(buildPageInfo(120, 2, 50)).toEqual({
      page: 2,
      limit: 50,
      total: 120,
      totalPages: 3,
      hasNext: true,
      hasPrev: true,
    })
  })
  it('has no neighbours for a single page', () => {
    const info = buildPageInfo(10, 1, 50)
    expect(info.hasNext).toBe(false)
    expect(info.hasPrev).toBe(false)
  })
})
