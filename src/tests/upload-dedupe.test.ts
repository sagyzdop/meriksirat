import { describe, expect, it } from 'vitest'
import { planEnqueue } from '@/lib/albums/upload-dedupe'

const job = (id: string, name: string, status: string, albumId = 'a') => ({
  id,
  name,
  status,
  albumId,
})

describe('planEnqueue', () => {
  it('accepts new names', () => {
    expect(planEnqueue('a', ['x.jpg'], [], new Set())).toEqual({
      acceptNames: ['x.jpg'],
      skipped: [],
      replaceJobIds: [],
    })
  })

  it('skips names already in the album', () => {
    const plan = planEnqueue('a', ['x.jpg'], [], new Set(['x.jpg']))
    expect(plan.acceptNames).toEqual([])
    expect(plan.skipped).toEqual(['x.jpg'])
  })

  it('skips names of queued or uploading jobs', () => {
    const jobs = [job('1', 'q.jpg', 'queued'), job('2', 'u.jpg', 'uploading')]
    const plan = planEnqueue('a', ['q.jpg', 'u.jpg'], jobs, new Set())
    expect(plan.acceptNames).toEqual([])
    expect(plan.skipped).toEqual(['q.jpg', 'u.jpg'])
    expect(plan.replaceJobIds).toEqual([])
  })

  it('replaces a failed job with the same name', () => {
    const plan = planEnqueue(
      'a',
      ['f.jpg'],
      [job('9', 'f.jpg', 'error')],
      new Set()
    )
    expect(plan.acceptNames).toEqual(['f.jpg'])
    expect(plan.skipped).toEqual([])
    expect(plan.replaceJobIds).toEqual(['9'])
  })

  it('ignores failed jobs of other albums', () => {
    const plan = planEnqueue(
      'a',
      ['f.jpg'],
      [job('9', 'f.jpg', 'error', 'b')],
      new Set()
    )
    expect(plan.acceptNames).toEqual(['f.jpg'])
    expect(plan.replaceJobIds).toEqual([])
  })

  it('dedupes same name within a batch', () => {
    const plan = planEnqueue('a', ['x.jpg', 'x.jpg'], [], new Set())
    expect(plan.acceptNames).toEqual(['x.jpg'])
    expect(plan.skipped).toEqual(['x.jpg'])
  })

  it('keeps a failed job when the name is already in the album', () => {
    const plan = planEnqueue(
      'a',
      ['f.jpg'],
      [job('9', 'f.jpg', 'error')],
      new Set(['f.jpg'])
    )
    expect(plan.skipped).toEqual(['f.jpg'])
    expect(plan.replaceJobIds).toEqual([])
  })
})
