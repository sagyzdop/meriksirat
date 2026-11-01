import { describe, expect, it } from 'vitest'
import {
  BudgetExhaustedError,
  RUN_SUBREQUEST_BUDGET,
  WORKER_SUBREQUEST_LIMIT,
  albumRemovalCost,
  batchDeleteCost,
  createBudget,
  takeIfBudgeted,
  takeUpToIfBudgeted,
} from '@/lib/cron/budget'

describe('createBudget', () => {
  it('keeps a margin under the Workers limit', () => {
    expect(RUN_SUBREQUEST_BUDGET).toBeLessThan(WORKER_SUBREQUEST_LIMIT)
    expect(createBudget().total).toBe(RUN_SUBREQUEST_BUDGET)
  })

  it('take is all or nothing', () => {
    const b = createBudget(5)
    expect(b.take(3)).toBe(true)
    expect(b.take(3)).toBe(false)
    expect(b.remaining()).toBe(2)
    expect(b.take(2)).toBe(true)
    expect(b.remaining()).toBe(0)
    expect(b.spent()).toBe(5)
  })

  it('takeUpTo grants what is left', () => {
    const b = createBudget(5)
    expect(b.takeUpTo(3)).toBe(3)
    expect(b.takeUpTo(10)).toBe(2)
    expect(b.takeUpTo(1)).toBe(0)
  })

  it('spend may overdraw but leaves nothing to take', () => {
    const b = createBudget(2)
    b.spend(5)
    expect(b.spent()).toBe(5)
    expect(b.remaining()).toBe(0)
    expect(b.canAfford(1)).toBe(false)
  })

  it('require throws when it cannot afford', () => {
    const b = createBudget(1)
    b.require(1)
    expect(() => b.require(1)).toThrow(BudgetExhaustedError)
  })

  it('ignores negative and rounds fractional costs up', () => {
    const b = createBudget(5)
    expect(b.take(-3)).toBe(true)
    expect(b.spent()).toBe(0)
    expect(b.take(1.2)).toBe(true)
    expect(b.spent()).toBe(2)
  })

  it('steps spend in order and later ones get the rest', () => {
    const b = createBudget(10)
    b.take(6)
    expect(b.takeUpTo(8)).toBe(4)
    expect(b.canAfford(1)).toBe(false)
  })
})

describe('sub budgets', () => {
  it('are capped and charge the parent', () => {
    const parent = createBudget(10)
    const child = parent.sub(4)
    expect(child.take(3)).toBe(true)
    expect(child.take(2)).toBe(false)
    expect(parent.remaining()).toBe(7)
    expect(child.remaining()).toBe(1)
  })

  it('cannot spend what the parent no longer has', () => {
    const parent = createBudget(10)
    const child = parent.sub(8)
    parent.take(7)
    expect(child.remaining()).toBe(3)
    expect(child.takeUpTo(8)).toBe(3)
    expect(parent.remaining()).toBe(0)
  })
})

describe('optional budgets', () => {
  it('take freely without a budget', () => {
    expect(takeIfBudgeted(undefined, 99)).toBe(true)
    expect(takeUpToIfBudgeted(undefined, 99)).toBe(99)
  })
  it('spend from a given budget', () => {
    const b = createBudget(2)
    expect(takeIfBudgeted(b, 3)).toBe(false)
    expect(takeUpToIfBudgeted(b, 3)).toBe(2)
  })
})

describe('cost estimates', () => {
  it('prices an album removal', () => {
    expect(albumRemovalCost([])).toBe(1)
    expect(albumRemovalCost([1])).toBe(3)
    expect(albumRemovalCost([100, 101])).toBe(1 + 2 + 3)
  })
  it('prices a batch delete', () => {
    expect(batchDeleteCost(0)).toBe(0)
    expect(batchDeleteCost(100)).toBe(2)
    expect(batchDeleteCost(101)).toBe(3)
  })
})
