import {
  DriveAuthError,
  batchDeleteDriveFiles,
  listDriveFolderUpTo,
} from '@/lib/google/google-drive'
import { DRIVE_BATCH_LIMIT, parseBatchResults } from '@/lib/google/drive-batch'
import { chunk } from '@/lib/utils'
import type { Budget } from '@/lib/cron/budget'
import type { FileIdentity } from './storage-plan'

const API = 'https://www.googleapis.com/drive/v3'
const COPY_BATCH = 20

export type DriveFileIdentity = FileIdentity & { mimeType: string }

export async function listIdentities(
  token: string,
  folderId: string,
  budget?: Budget
): Promise<DriveFileIdentity[]> {
  const { files, complete } = await listDriveFolderUpTo(
    token,
    folderId,
    () => !budget || budget.take(1)
  )
  if (!complete) throw new Error('Folder listing was cut short')
  return files.map((f) => ({
    id: f.id,
    name: f.name,
    size: Number(f.size ?? 0) || 0,
    md5: f.md5Checksum ?? '',
    mimeType: f.mimeType,
  }))
}

export async function copyFilesInto(
  token: string,
  files: { id: string; name: string }[],
  folderId: string,
  budget?: Budget
): Promise<void> {
  for (const group of chunk(files, COPY_BATCH)) {
    if (budget && !budget.take(1)) throw new Error('Copy needs another run')
    const boundary = `batch_${crypto.randomUUID()}`
    const lines: string[] = []
    group.forEach((file, index) => {
      lines.push(
        `--${boundary}`,
        'Content-Type: application/http',
        `Content-ID: <${index}>`,
        '',
        `POST /drive/v3/files/${encodeURIComponent(file.id)}/copy?fields=id`,
        'Content-Type: application/json',
        '',
        JSON.stringify({ name: file.name, parents: [folderId] }),
        ''
      )
    })
    lines.push(`--${boundary}--`, '')
    const response = await fetch('https://www.googleapis.com/batch/drive/v3', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/mixed; boundary=${boundary}`,
      },
      body: lines.join('\r\n'),
    })
    if (!response.ok) {
      throw new Error(`Drive batch copy failed (${response.status})`)
    }
    const ids = group.map((f) => f.id)
    const results = parseBatchResults(await response.text(), ids)
    for (const result of results.values()) {
      if (result.status === 401) throw new DriveAuthError()
    }
    const failed = ids.filter((id) => {
      const status = results.get(id)?.status
      return status === undefined || status >= 300
    })
    if (failed.length > 0) {
      throw new Error(`Drive could not copy ${failed.length} files`)
    }
  }
}

export async function shareFolderWith(
  token: string,
  folderId: string,
  emailAddress: string,
  role: 'reader' | 'writer'
): Promise<string> {
  const response = await fetch(
    `${API}/files/${folderId}/permissions?sendNotificationEmail=false&fields=id`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: 'user', role, emailAddress }),
    }
  )
  if (!response.ok) {
    throw new Error(`Could not share the folder (${response.status})`)
  }
  return ((await response.json()) as { id: string }).id
}

export async function deleteFiles(
  token: string,
  ids: string[],
  budget?: Budget
): Promise<string[]> {
  const failed: string[] = []
  for (const group of chunk(ids, DRIVE_BATCH_LIMIT)) {
    if (budget && !budget.take(1)) {
      failed.push(...group)
      continue
    }
    failed.push(...(await batchDeleteDriveFiles(token, group)))
  }
  return failed
}
