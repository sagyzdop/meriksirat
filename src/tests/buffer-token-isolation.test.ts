import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = join(__dirname, '..')
const ROOT = join(SRC, '..')

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) walk(path, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(path)
  }
  return out
}

function filesMentioning(needle: string): string[] {
  return walk(SRC)
    .filter((f) => !f.startsWith(join(SRC, 'tests')))
    .filter((f) => readFileSync(f, 'utf8').includes(needle))
    .map((f) => relative(ROOT, f))
}

describe('the buffer refresh token', () => {
  it('is read from the environment only inside the grant module', () => {
    expect(filesMentioning('GOOGLE_BUFFER_FULL')).toEqual([
      'src/lib/buffer/grant.ts',
    ])
  })

  it('is encrypted with a key read only in server-only modules', () => {
    expect(filesMentioning('process.env.BUFFER_ENCRYPTION_KEY')).toEqual([
      'src/lib/buffer/account-functions.ts',
      'src/lib/buffer/grant.ts',
    ])
  })

  it('has no client-visible env name', () => {
    expect(filesMentioning('VITE_GOOGLE_BUFFER')).toEqual([])
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
    expect(vite).not.toContain('GOOGLE_BUFFER')
  })

  it('sits in modules that are no server function or component', () => {
    for (const file of ['grant.ts', 'tokens.ts', 'crypto.ts']) {
      const source = readFileSync(join(SRC, 'lib/buffer', file), 'utf8')
      expect(source).not.toContain('createServerFn')
    }
  })
})

describe('upload sessions', () => {
  it('hand the browser only an upload address', () => {
    const types = readFileSync(join(SRC, 'lib/albums/types.ts'), 'utf8')
    const block = types.slice(types.indexOf('export interface UploadSession'))
    expect(block).toMatch(/uploadUrl: string/)
    expect(block).not.toMatch(/token/i)
  })
})
