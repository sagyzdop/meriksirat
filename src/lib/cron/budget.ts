export const WORKER_SUBREQUEST_LIMIT = 50
export const RUN_SUBREQUEST_BUDGET = 40

export class BudgetExhaustedError extends Error {
  constructor() {
    super('Cron subrequest budget exhausted')
    this.name = 'BudgetExhaustedError'
  }
}

export interface Budget {
  readonly total: number
  remaining(): number
  spent(): number
  canAfford(n: number): boolean
  take(n: number): boolean
  takeUpTo(n: number): number
  spend(n: number): void
  require(n: number): void
  sub(cap: number): Budget
}

function whole(n: number): number {
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : 0
}

/**
 * Outside requests (Google, Telegram) one cron run may still make. One
 * object is shared by every step, which spend from it in priority order.
 * `take` is all or nothing, `takeUpTo` grants part of a request, `spend`
 * records a cost already paid and may overdraw (the margin under Workers'
 * limit absorbs it).
 */
export function createBudget(total: number = RUN_SUBREQUEST_BUDGET): Budget {
  let used = 0
  const budget: Budget = {
    total,
    remaining: () => Math.max(0, total - used),
    spent: () => used,
    canAfford: (n) => whole(n) <= Math.max(0, total - used),
    take(n) {
      const cost = whole(n)
      if (cost > Math.max(0, total - used)) return false
      used += cost
      return true
    },
    takeUpTo(n) {
      const granted = Math.min(whole(n), Math.max(0, total - used))
      used += granted
      return granted
    },
    spend(n) {
      used += whole(n)
    },
    require(n) {
      if (!budget.take(n)) throw new BudgetExhaustedError()
    },
    sub(cap) {
      return createSubBudget(budget, whole(cap))
    },
  }
  return budget
}

function createSubBudget(parent: Budget, cap: number): Budget {
  let used = 0
  const room = () => Math.max(0, Math.min(cap - used, parent.remaining()))
  const budget: Budget = {
    total: cap,
    remaining: room,
    spent: () => used,
    canAfford: (n) => whole(n) <= room(),
    take(n) {
      const cost = whole(n)
      if (cost > room()) return false
      parent.spend(cost)
      used += cost
      return true
    },
    takeUpTo(n) {
      const granted = Math.min(whole(n), room())
      parent.spend(granted)
      used += granted
      return granted
    },
    spend(n) {
      const cost = whole(n)
      parent.spend(cost)
      used += cost
    },
    require(n) {
      if (!budget.take(n)) throw new BudgetExhaustedError()
    },
    sub(innerCap) {
      return createSubBudget(budget, whole(innerCap))
    },
  }
  return budget
}

export function takeIfBudgeted(budget: Budget | undefined, n: number): boolean {
  return budget ? budget.take(n) : true
}

export function takeUpToIfBudgeted(
  budget: Budget | undefined,
  n: number
): number {
  return budget ? budget.takeUpTo(n) : n
}

/**
 * Requests needed to remove an album: the folder delete plus, for each
 * flamekeeper holding photos in it, a token refresh and one batch call per
 * 100 photos.
 */
export function albumRemovalCost(photosPerOwner: number[]): number {
  let cost = 1
  for (const n of photosPerOwner) {
    if (n > 0) cost += batchDeleteCost(n)
  }
  return cost
}

/** Requests for a batch delete of `photos` files with one owner's token. */
export function batchDeleteCost(photos: number): number {
  return photos > 0 ? 1 + Math.ceil(photos / 100) : 0
}
