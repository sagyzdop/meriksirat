import { describe, expect, it } from 'vitest'
import {
  buildBatchDeleteBody,
  parseBatchResults,
} from '@/lib/google/drive-batch'

describe('buildBatchDeleteBody', () => {
  it('writes one DELETE part per file with its index as Content-ID', () => {
    const body = buildBatchDeleteBody(['f1', 'f2'], 'b')
    expect(body).toBe(
      [
        '--b',
        'Content-Type: application/http',
        'Content-ID: <0>',
        '',
        'DELETE /drive/v3/files/f1',
        '',
        '--b',
        'Content-Type: application/http',
        'Content-ID: <1>',
        '',
        'DELETE /drive/v3/files/f2',
        '',
        '--b--',
        '',
      ].join('\r\n')
    )
  })
})

describe('parseBatchResults statuses', () => {
  it('maps each response part back to its file by Content-ID', () => {
    const response = [
      '--batch_x',
      'Content-Type: application/http',
      'Content-ID: <response-1>',
      '',
      'HTTP/1.1 404 Not Found',
      'Content-Type: application/json; charset=UTF-8',
      '',
      '{"error": {"code": 404}}',
      '--batch_x',
      'Content-Type: application/http',
      'Content-ID: response-0',
      '',
      'HTTP/1.1 204 No Content',
      '',
      '',
      '--batch_x--',
    ].join('\r\n')
    const results = parseBatchResults(response, ['f1', 'f2'])
    expect(results.get('f1')?.status).toBe(204)
    expect(results.get('f2')?.status).toBe(404)
  })

  it('leaves out files whose part is missing', () => {
    expect(parseBatchResults('--x--', ['f1'])).toEqual(new Map())
  })
})
