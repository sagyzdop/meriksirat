import { beforeEach, describe, expect, it, vi } from 'vitest'

const setMyCommands = vi.fn()

vi.mock('@/lib/telegram/api', () => ({
  TelegramAPI: class {
    setMyCommands = setMyCommands
  },
}))

import { createBudget } from '@/lib/cron/budget'
import {
  configureTelegramBotOncePerDeploy as configureOnce,
  type MarkerStore,
} from '@/lib/telegram/configure'

type TestEnv = ReturnType<typeof env>

const configureTelegramBotOncePerDeploy = (
  e: TestEnv,
  budget: ReturnType<typeof createBudget>
) => configureOnce(e, budget, e.markers)

function fakeKv(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    kv: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value)
      },
    } satisfies MarkerStore,
  }
}

function env(kv: MarkerStore, version = 'v1', token: string | null = 't') {
  return {
    markers: kv,
    TELEGRAM_BOT_TOKEN: token ?? undefined,
    CF_VERSION_METADATA: { id: version, tag: '', timestamp: '' },
  }
}

beforeEach(() => {
  setMyCommands.mockReset()
  setMyCommands.mockResolvedValue(undefined)
})

describe('configureTelegramBotOncePerDeploy', () => {
  it('configures the bot on the first run of a deploy', async () => {
    const { kv } = fakeKv()
    await configureTelegramBotOncePerDeploy(env(kv), createBudget())
    expect(setMyCommands).toHaveBeenCalledTimes(1)
  })

  it('does nothing on later runs of the same deploy', async () => {
    const { kv } = fakeKv()
    await configureTelegramBotOncePerDeploy(env(kv), createBudget())
    await configureTelegramBotOncePerDeploy(env(kv), createBudget())
    await configureTelegramBotOncePerDeploy(env(kv), createBudget())
    expect(setMyCommands).toHaveBeenCalledTimes(1)
  })

  it('configures again after a new deploy', async () => {
    const { kv } = fakeKv()
    await configureTelegramBotOncePerDeploy(env(kv, 'v1'), createBudget())
    await configureTelegramBotOncePerDeploy(env(kv, 'v2'), createBudget())
    expect(setMyCommands).toHaveBeenCalledTimes(2)
  })

  it('does not mark the deploy done when there is no bot token', async () => {
    const { kv, store } = fakeKv()
    await configureTelegramBotOncePerDeploy(env(kv, 'v1', null), createBudget())
    expect(setMyCommands).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })

  it('tries again next run if Telegram fails', async () => {
    const { kv } = fakeKv()
    setMyCommands.mockRejectedValueOnce(new Error('boom'))
    await expect(
      configureTelegramBotOncePerDeploy(env(kv), createBudget())
    ).rejects.toThrow('boom')
    await configureTelegramBotOncePerDeploy(env(kv), createBudget())
    expect(setMyCommands).toHaveBeenCalledTimes(2)
  })

  it('skips without a budget to spend', async () => {
    const { kv, store } = fakeKv()
    const budget = createBudget(1)
    budget.spend(1)
    await configureTelegramBotOncePerDeploy(env(kv), budget)
    expect(setMyCommands).not.toHaveBeenCalled()
    expect(store.size).toBe(0)
  })
})
