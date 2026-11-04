import { describe, expect, it } from 'vitest'
import {
  canDeleteGoneAlbum,
  folderCheckVerdict,
  folderWarning,
} from '@/lib/albums/folder-warning'

describe('folderWarning', () => {
  it('shows nothing for a healthy folder', () => {
    expect(folderWarning('ok', { isAdmin: false })).toBeNull()
    expect(folderWarning('ok', { isAdmin: true })).toBeNull()
  })

  it('warns about a trashed folder without offering a delete', () => {
    const w = folderWarning('trashed', { isAdmin: true })
    expect(w?.title).toMatch(/bin/i)
    expect(w?.canDelete).toBe(false)
  })

  it('warns about a missing folder', () => {
    const w = folderWarning('missing', { isAdmin: false })
    expect(w?.title).toMatch(/deleted/i)
  })

  it('offers deleting the album to admins only, and only when permanently gone', () => {
    expect(folderWarning('missing', { isAdmin: true })?.canDelete).toBe(true)
    expect(folderWarning('missing', { isAdmin: false })?.canDelete).toBe(false)
  })

  it('never promises a restore or recreate', () => {
    for (const state of ['trashed', 'missing'] as const) {
      const w = folderWarning(state, { isAdmin: true })!
      expect(`${w.title} ${w.description}`).not.toMatch(/recreat|restor/i)
    }
  })
})

describe('folderCheckVerdict', () => {
  it('treats only a definite missing state as missing', () => {
    expect(folderCheckVerdict({ state: 'missing' })).toBe('missing')
    expect(folderCheckVerdict({ state: 'ok' })).toBe('exists')
    expect(folderCheckVerdict({ state: 'trashed' })).toBe('exists')
    expect(folderCheckVerdict({ error: new Error('boom') })).toBe('unknown')
  })
})

describe('canDeleteGoneAlbum', () => {
  it('allows an admin when the folder is confirmed gone', () => {
    expect(canDeleteGoneAlbum('missing', { isAdmin: true })).toEqual({
      ok: true,
    })
  })

  it('refuses non-admins', () => {
    expect(canDeleteGoneAlbum('missing', { isAdmin: false }).ok).toBe(false)
  })

  it('refuses when the folder still exists or the check was inconclusive', () => {
    expect(canDeleteGoneAlbum('exists', { isAdmin: true }).ok).toBe(false)
    expect(canDeleteGoneAlbum('unknown', { isAdmin: true }).ok).toBe(false)
  })
})
