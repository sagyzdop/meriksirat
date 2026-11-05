import { describe, it, expect } from 'vitest'
import { flamekeeperPresentation } from '../lib/flamekeeper/profile-copy'

const GB = 1024 * 1024 * 1024
const pledged = (state: 'active' | 'full' | 'draining' | 'lost', used = 0) => ({
  state,
  pledgedBytes: 5 * GB,
  usedBytes: used,
})

describe('flamekeeperPresentation', () => {
  it.each([null, { state: 'drained' as const, pledgedBytes: 0, usedBytes: 0 }])(
    'invites someone who is not flamekeeping yet (%j)',
    (fk) => {
      const view = flamekeeperPresentation(fk)
      expect(view.title).toBe('Keep the flame alive')
      expect(view.description).toBe(
        "Lend a little of your NU Drive to the club's albums."
      )
      expect(view.icon).toBe('ember')
      expect(view.action).toBe('become')
      expect(view.pledge).toBeNull()
    }
  )

  it('thanks a flamekeeper with nothing stored, with a pulse and the pledge line', () => {
    const view = flamekeeperPresentation(pledged('active'))
    expect(view.title).toBe("You're keeping the flame alive")
    expect(view.description).toBe('Thank you for your service 🫡🇰🇿')
    expect(view.icon).toBe('ember')
    expect(view.action).toBeNull()
    expect(view.pledge).toEqual({ line: '0 GB of 5 GB pledged', percent: 0 })
  })

  it('shows the lit flame once photos are stored', () => {
    const view = flamekeeperPresentation(pledged('full', 1.25 * GB))
    expect(view.title).toBe("You're keeping the flame alive")
    expect(view.icon).toBe('flame')
    expect(view.pledge).toEqual({ line: '1.3 GB of 5 GB pledged', percent: 25 })
  })

  it('tells a leaving flamekeeper there is nothing to do', () => {
    const view = flamekeeperPresentation(pledged('draining', GB))
    expect(view.title).toBe('Your flame is winding down')
    expect(view.description).toBe(
      'Thank you for keeping it lit. Nothing to do on your side.'
    )
    expect(view.icon).toBe('fading')
    expect(view.action).toBeNull()
  })

  it('asks a lost flamekeeper to reconnect', () => {
    const view = flamekeeperPresentation(pledged('lost', GB))
    expect(view.title).toBe('We lost touch with your Drive')
    expect(view.description).toBe(
      'Reconnect within 7 days to keep your flame lit.'
    )
    expect(view.icon).toBe('out')
    expect(view.action).toBe('reconnect')
  })

  it('caps the progress at 100 percent', () => {
    expect(
      flamekeeperPresentation(pledged('full', 9 * GB)).pledge?.percent
    ).toBe(100)
  })

  it.each(['active', 'full', 'draining', 'lost'] as const)(
    'never mentions the buffer or moving photos (%s)',
    (state) => {
      const view = flamekeeperPresentation(pledged(state, GB))
      const text = `${view.title} ${view.description} ${view.pledge?.line}`
      expect(text).not.toMatch(/buffer|moving|move/i)
    }
  )
})
