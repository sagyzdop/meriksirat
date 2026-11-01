/**
 * Minimal Google Drive REST client used by the album feature.
 * Calls take the access token of whoever owns the files: the master account
 * for album folders, a flamekeeper for the photos they hold (ADR-0008).
 * All calls are performed server-side. The only call that involves the browser directly is
 * the resumable upload session: the server mints an upload URL and the
 * browser PUTs the file bytes straight to Google (never through a Worker).
 * Reference: https://developers.google.com/drive/api/reference/rest/v3
 */

export interface DriveFileMeta {
  id: string
  name: string
  mimeType: string
  size?: string
  createdTime?: string
  imageMediaMetadata?: {
    time?: string
    cameraMake?: string
    cameraModel?: string
    exposureTime?: string
    aperture?: number
    focalLength?: number
    isoSpeed?: number
    width?: number
    height?: number
    rotation?: number
    whiteBalance?: string
    flash?: string
    colorSpace?: string
    meteringMode?: string
    exposureBias?: number
    exposureMode?: string
  }
}

const API = 'https://www.googleapis.com/drive/v3'
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3'

export class DriveNotFoundError extends Error {
  constructor(message = 'Drive file not found') {
    super(message)
    this.name = 'DriveNotFoundError'
  }
}

export class DriveQuotaExceededError extends Error {
  constructor(message = 'Drive storage quota exceeded') {
    super(message)
    this.name = 'DriveQuotaExceededError'
  }
}

async function driveFetch(
  accessToken: string,
  url: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.headers ?? {}),
    },
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new DriveNotFoundError()
    }
    const body = await response.text()
    if (response.status === 403 && body.includes('storageQuotaExceeded')) {
      throw new DriveQuotaExceededError()
    }
    throw new Error(`Drive API error (${response.status}): ${body}`)
  }

  return response
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string
): Promise<{ id: string }> {
  const response = await driveFetch(accessToken, `${API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(parentId ? { parents: [parentId] } : {}),
    }),
  })
  return (await response.json()) as { id: string }
}

/**
 * Find an existing folder by name inside `parentId`, or create it. Used to
 * build the Albums/{year}/{month} hierarchy without duplicating folders.
 */
export async function getOrCreateDriveFolder(
  accessToken: string,
  name: string,
  parentId: string
): Promise<{ id: string }> {
  const params = new URLSearchParams({
    q: `name = '${name.replaceAll("'", "\\'")}' and '${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    pageSize: '1',
  })
  const response = await driveFetch(
    accessToken,
    `${API}/files?${params.toString()}`
  )
  const data = (await response.json()) as { files?: { id: string }[] }
  if (data.files?.[0]) return data.files[0]
  return createDriveFolder(accessToken, name, parentId)
}

/**
 * List the files directly inside a folder, paging through all results.
 */
export async function listDriveFolderFiles(
  accessToken: string,
  folderId: string
): Promise<DriveFileMeta[]> {
  const files: DriveFileMeta[] = []
  let pageToken: string | undefined

  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed=false`,
      fields:
        'nextPageToken, files(id, name, mimeType, size, createdTime, imageMediaMetadata)',
      pageSize: '1000',
      orderBy: 'createdTime',
    })
    if (pageToken) params.set('pageToken', pageToken)

    const response = await driveFetch(
      accessToken,
      `${API}/files?${params.toString()}`
    )
    const data = (await response.json()) as {
      files?: DriveFileMeta[]
      nextPageToken?: string
    }
    files.push(...(data.files ?? []))
    pageToken = data.nextPageToken
  } while (pageToken)

  return files
}

export interface DriveFileWithParents extends DriveFileMeta {
  parents?: string[]
  trashed?: boolean
}

export async function getDriveFileMeta(
  accessToken: string,
  fileId: string
): Promise<DriveFileWithParents> {
  const params = new URLSearchParams({
    fields:
      'id, name, mimeType, size, createdTime, parents, trashed, imageMediaMetadata',
  })
  const response = await driveFetch(
    accessToken,
    `${API}/files/${fileId}?${params.toString()}`
  )
  return (await response.json()) as DriveFileWithParents
}

export type DriveFolderState = 'ok' | 'trashed' | 'missing'

/**
 * Check whether an album folder is healthy, sitting in the Drive bin, or
 * permanently deleted. A trashed folder still resolves via `files.get`
 * (with `trashed: true`), while a permanently deleted one returns 404.
 */
export async function getDriveFolderState(
  accessToken: string,
  folderId: string
): Promise<DriveFolderState> {
  const response = await driveFetch(
    accessToken,
    `${API}/files/${folderId}?fields=id,trashed`
  )
  const data = (await response.json()) as { trashed?: boolean }
  return data.trashed ? 'trashed' : 'ok'
}

/**
 * Move a trashed file or folder out of the bin so it is usable again.
 */
export async function restoreDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetch(accessToken, `${API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ trashed: false }),
  })
}

/**
 * Find an existing file by exact name inside `parentId` (not trashed).
 * Returns null when no match exists.
 */
export async function findDriveFileByName(
  accessToken: string,
  name: string,
  parentId: string
): Promise<{ id: string; name: string } | null> {
  const params = new URLSearchParams({
    q: `name = '${name.replaceAll("'", "\\'")}' and '${parentId}' in parents and trashed=false`,
    fields: 'files(id, name)',
    pageSize: '1',
  })
  const response = await driveFetch(
    accessToken,
    `${API}/files?${params.toString()}`
  )
  const data = (await response.json()) as {
    files?: { id: string; name: string }[]
  }
  return data.files?.[0] ?? null
}

/**
 * Rename an existing file or folder. File IDs and CDN URLs are unaffected.
 */
export async function renameDriveFile(
  accessToken: string,
  fileId: string,
  name: string
): Promise<void> {
  await driveFetch(accessToken, `${API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
}

export async function deleteDriveFile(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetch(accessToken, `${API}/files/${fileId}`, {
    method: 'DELETE',
  })
}

/**
 * Grant read access to anyone with the link. This makes every file inside the
 * folder directly viewable through the Google CDN without authentication.
 * Album folders always have this permission: it is set at creation and never
 * revoked.
 */
export async function setAnyoneReader(
  accessToken: string,
  fileId: string
): Promise<void> {
  await driveFetch(accessToken, `${API}/files/${fileId}/permissions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'anyone', role: 'reader' }),
  })
}

/**
 * Start a resumable upload session for a file that will be created inside
 * `folderId`. Returns Google's upload URL; the client must PUT the file bytes
 * to that URL with `Content-Type: text/plain` (avoids a CORS preflight).
 *
 * Pass the browser's `origin` if the upload will happen from the browser:
 * Google binds the session's Access-Control-Allow-Origin to the Origin of the
 * session-start request, so without it the browser cannot read the upload
 * response (CORS error) even though the file uploads successfully.
 */
export async function mintResumableUpload(
  accessToken: string,
  opts: {
    name: string
    folderId: string
    mimeType: string
    size?: number
    origin?: string
  }
): Promise<string> {
  const response = await driveFetch(
    accessToken,
    `${UPLOAD_API}/files?uploadType=resumable`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Upload-Content-Type': opts.mimeType,
        ...(opts.size ? { 'X-Upload-Content-Length': String(opts.size) } : {}),
        ...(opts.origin ? { Origin: opts.origin } : {}),
      },
      body: JSON.stringify({
        name: opts.name,
        mimeType: opts.mimeType,
        parents: [opts.folderId],
      }),
    }
  )

  const location = response.headers.get('Location')
  if (!location) {
    throw new Error('Drive did not return an upload URL')
  }
  return location
}

/**
 * Share a folder with one account as writer, without Google's notification
 * email. Returns the permission ID so the share can be revoked later.
 */
export async function shareWithWriter(
  accessToken: string,
  fileId: string,
  emailAddress: string
): Promise<string> {
  const response = await driveFetch(
    accessToken,
    `${API}/files/${fileId}/permissions?sendNotificationEmail=false&fields=id`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'user', role: 'writer', emailAddress }),
    }
  )
  const data = (await response.json()) as { id: string }
  return data.id
}

/**
 * Revoke one permission on a file (e.g. a flamekeeper's writer share on an
 * album folder). A permission that is already gone counts as revoked.
 */
export async function deleteDrivePermission(
  accessToken: string,
  fileId: string,
  permissionId: string
): Promise<void> {
  try {
    await driveFetch(
      accessToken,
      `${API}/files/${fileId}/permissions/${permissionId}`,
      { method: 'DELETE' }
    )
  } catch (error) {
    if (!(error instanceof DriveNotFoundError)) throw error
  }
}

/**
 * Bytes this account's Drive files take up. `about.get` reports the org-wide
 * limit, so only `usageInDrive` is meaningful per account.
 */
export async function getDriveUsageInDrive(
  accessToken: string
): Promise<number> {
  const response = await driveFetch(
    accessToken,
    `${API}/about?fields=storageQuota(usageInDrive)`
  )
  const data = (await response.json()) as {
    storageQuota?: { usageInDrive?: string }
  }
  return Number(data.storageQuota?.usageInDrive ?? 0)
}

/**
 * Delete files in batches of 100 (one subrequest each). Files that are
 * already gone count as deleted. Returns the IDs Drive refused to delete.
 */
export async function batchDeleteDriveFiles(
  accessToken: string,
  fileIds: string[]
): Promise<string[]> {
  const { DRIVE_BATCH_LIMIT, buildBatchDeleteBody, parseBatchStatuses } =
    await import('./drive-batch')
  const failed: string[] = []
  for (let i = 0; i < fileIds.length; i += DRIVE_BATCH_LIMIT) {
    const ids = fileIds.slice(i, i + DRIVE_BATCH_LIMIT)
    const boundary = `batch_${crypto.randomUUID()}`
    const response = await driveFetch(
      accessToken,
      'https://www.googleapis.com/batch/drive/v3',
      {
        method: 'POST',
        headers: { 'Content-Type': `multipart/mixed; boundary=${boundary}` },
        body: buildBatchDeleteBody(ids, boundary),
      }
    )
    const statuses = parseBatchStatuses(await response.text(), ids)
    for (const id of ids) {
      const status = statuses.get(id)
      if (status === undefined || (status >= 300 && status !== 404)) {
        failed.push(id)
      }
    }
  }
  return failed
}
