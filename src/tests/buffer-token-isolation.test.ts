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

describe('the buffer full-scope token', () => {
  it('is named only inside the server-only token module', () => {
    expect(filesMentioning('GOOGLE_BUFFER_FULL')).toEqual([
      'src/lib/buffer/full-token.ts',
    ])
  })

  it('is imported by no other module', () => {
    expect(filesMentioning('getBufferFullAccessToken')).toEqual([
      'src/lib/buffer/full-token.ts',
    ])
  })

  it('has no client-visible env name', () => {
    expect(filesMentioning('VITE_GOOGLE_BUFFER')).toEqual([])
    const vite = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8')
    expect(vite).not.toContain('GOOGLE_BUFFER')
  })

  it('sits in a module that is no server function or component', () => {
    const source = readFileSync(join(SRC, 'lib/buffer/full-token.ts'), 'utf8')
    expect(source).not.toContain('createServerFn')
    expect(source).not.toContain("'cloudflare:workers'")
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
