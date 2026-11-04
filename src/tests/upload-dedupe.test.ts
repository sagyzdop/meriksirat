import { describe, expect, it } from 'vitest'
import {
  duplicateMessage,
  isDuplicateRejection,
  planDuplicateCheck,
  planEnqueue,
} from '@/lib/albums/upload-dedupe'

const job = (
  id: string,
  name: string,
  status: string,
  albumId = 'a',
  size = 10
) => ({ id, name, size, status, albumId })

const pick = (name: string, size = 10) => ({ name, size })

describe('planEnqueue', () => {
  it('accepts new files', () => {
    expect(planEnqueue('a', [pick('x.jpg')], [])).toEqual({
      acceptNames: ['x.jpg'],
      skipped: [],
      replaceJobIds: [],
    })
  })

  it('accepts a name the album already has, since filenames are ignored', () => {
    const plan = planEnqueue('a', [pick('IMG_1.jpg', 7)], [])
    expect(plan.acceptNames).toEqual(['IMG_1.jpg'])
    expect(plan.skipped).toEqual([])
  })

  it('skips the same file already queued or uploading', () => {
    const jobs = [job('1', 'q.jpg', 'queued'), job('2', 'u.jpg', 'uploading')]
    const plan = planEnqueue('a', [pick('q.jpg'), pick('u.jpg')], jobs)
    expect(plan.acceptNames).toEqual([])
    expect(plan.skipped).toEqual(['q.jpg', 'u.jpg'])
    expect(plan.replaceJobIds).toEqual([])
  })

  it('accepts a queued name when the size differs', () => {
    const plan = planEnqueue(
      'a',
      [pick('q.jpg', 11)],
      [job('1', 'q.jpg', 'queued')]
    )
    expect(plan.acceptNames).toEqual(['q.jpg'])
  })

  it('replaces a failed job for the same file', () => {
    const plan = planEnqueue('a', [pick('f.jpg')], [job('9', 'f.jpg', 'error')])
    expect(plan.acceptNames).toEqual(['f.jpg'])
    expect(plan.skipped).toEqual([])
    expect(plan.replaceJobIds).toEqual(['9'])
  })

  it('ignores failed jobs of other albums', () => {
    const plan = planEnqueue(
      'a',
      [pick('f.jpg')],
      [job('9', 'f.jpg', 'error', 'b')]
    )
    expect(plan.acceptNames).toEqual(['f.jpg'])
    expect(plan.replaceJobIds).toEqual([])
  })

  it('skips the same file twice in a batch', () => {
    const plan = planEnqueue('a', [pick('x.jpg'), pick('x.jpg')], [])
    expect(plan.acceptNames).toEqual(['x.jpg'])
    expect(plan.skipped).toEqual(['x.jpg'])
  })

  it('keeps two different files that share a name in a batch', () => {
    const plan = planEnqueue('a', [pick('x.jpg', 1), pick('x.jpg', 2)], [])
    expect(plan.acceptNames).toEqual(['x.jpg', 'x.jpg'])
    expect(plan.skipped).toEqual([])
  })
})

const listed = (size: number, md5Checksum?: string, name = 'any.jpg') => ({
  id: `${name}-${size}-${md5Checksum ?? ''}`,
  name,
  size: String(size),
  md5Checksum,
})

describe('planDuplicateCheck', () => {
  it('needs a hash when a listed file has the same size', () => {
    expect(planDuplicateCheck(100, undefined, [listed(100, 'aaa')])).toEqual({
      kind: 'needs-hash',
    })
  })

  it('does not ask for a hash when no listed file has the size', () => {
    expect(planDuplicateCheck(100, undefined, [listed(99, 'aaa')])).toEqual({
      kind: 'unique',
    })
    expect(planDuplicateCheck(100, undefined, [])).toEqual({ kind: 'unique' })
  })

  it('flags a renamed copy: same size and MD5, any filename', () => {
    const files = [listed(100, 'aaa', 'IMG_1.jpg')]
    expect(planDuplicateCheck(100, 'aaa', files)).toEqual({ kind: 'duplicate' })
  })

  it('keeps a same-named but different photo: same size, other MD5', () => {
    const files = [listed(100, 'aaa', 'IMG_1.jpg')]
    expect(planDuplicateCheck(100, 'bbb', files)).toEqual({ kind: 'unique' })
  })

  it('does not hash-match when no size matches, even with a hash given', () => {
    expect(planDuplicateCheck(100, 'aaa', [listed(99, 'aaa')])).toEqual({
      kind: 'unique',
    })
  })

  it('ignores listed files without a checksum', () => {
    expect(planDuplicateCheck(100, 'aaa', [listed(100)])).toEqual({
      kind: 'unique',
    })
  })

  it('compares checksums case-insensitively', () => {
    expect(planDuplicateCheck(100, 'AAA', [listed(100, 'aaa')])).toEqual({
      kind: 'duplicate',
    })
  })
})

describe('duplicate rejection', () => {
  it('recognises the rejection the server raises for a duplicate', () => {
    expect(isDuplicateRejection(new Error(duplicateMessage('IMG_1.jpg')))).toBe(
      true
    )
  })

  it('does not mistake other failures for a duplicate', () => {
    expect(isDuplicateRejection(new Error('Network down'))).toBe(false)
    expect(isDuplicateRejection('already exists in this album')).toBe(false)
  })
})
