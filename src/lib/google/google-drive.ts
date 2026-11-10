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
  md5Checksum?: string
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

export class DriveAuthError extends Error {
  constructor(message = 'Drive rejected the access token') {
    super(message)
    this.name = 'DriveAuthError'
  }
}

export class DriveAppNotAuthorizedError extends Error {
  constructor(message = 'Drive folder holds files this app may not touch') {
    super(message)
    this.name = 'DriveAppNotAuthorizedError'
  }
}

export function driveErrorFor(status: number, body: string): Error {
  if (status === 401) {
    return new DriveAuthError(`Drive API error (401): ${body}`)
  }
  if (status === 404) return new DriveNotFoundError()
  if (status === 403 && body.includes('storageQuotaExceeded')) {
    return new DriveQuotaExceededError()
  }
  if (status === 403 && body.includes('appNotAuthorizedToChild')) {
    return new DriveAppNotAuthorizedError()
  }
  return new Error(`Drive API error (${status}): ${body}`)
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
    throw driveErrorFor(response.status, await response.text())
  }

  return response
}

export const driveDescription = (text: string) => text.slice(0, 4000)

export async function setDriveDescription(
  accessToken: string,
  fileId: string,
  description: string
): Promise<void> {
  await driveFetch(accessToken, `${API}/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: driveDescription(description) }),
  })
}

export async function createDriveFolder(
  accessToken: string,
  name: string,
  parentId?: string,
  description?: string
): Promise<{ id: string }> {
  const response = await driveFetch(accessToken, `${API}/files`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder',
      ...(description ? { description: driveDescription(description) } : {}),
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

const LISTING_FIELDS =
  'nextPageToken, files(id, name, mimeType, size, md5Checksum, createdTime, imageMediaMetadata(time, cameraMake, cameraModel, exposureTime, aperture, focalLength, isoSpeed, width, height, whiteBalance))'

/**
 * List the files directly inside a folder, page by page, until the folder is
 * done or `mayRequest` refuses another page. `complete` says which it was.
 */
export async function listDriveFolderUpTo(
  accessToken: string,
  folderId: string,
  mayRequest: () => boolean
): Promise<{ files: DriveFileMeta[]; complete: boolean }> {
  const files: DriveFileMeta[] = []
  let pageToken: string | undefined

  do {
    if (!mayRequest()) return { files, complete: false }
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
      fields: LISTING_FIELDS,
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

  return { files, complete: true }
}

export async function listDriveFolderFiles(
  accessToken: string,
  folderId: string,
  beforeRequest?: () => void
): Promise<DriveFileMeta[]> {
  const { files } = await listDriveFolderUpTo(accessToken, folderId, () => {
    beforeRequest?.()
    return true
  })
  return files
}

export async function listDriveFolderFileIds(
  accessToken: string,
  folderId: string,
  limit: number
): Promise<string[]> {
  const params = new URLSearchParams({
    q: `'${folderId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id)',
    pageSize: String(limit),
  })
  const response = await driveFetch(
    accessToken,
    `${API}/files?${params.toString()}`
  )
  const data = (await response.json()) as { files?: { id: string }[] }
  return (data.files ?? []).map((f) => f.id)
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
      'id, name, mimeType, size, md5Checksum, createdTime, parents, trashed, imageMediaMetadata',
  })
  const response = await driveFetch(
    accessToken,
    `${API}/files/${fileId}?${params.toString()}`
  )
  return (await response.json()) as DriveFileWithParents
}

export type DriveFolderState = 'ok' | 'trashed' | 'missing'

/**
 * Check whether a Drive file or folder is healthy, sitting in the Drive bin,
 * or permanently deleted. A trashed item still resolves via `files.get`
 * (with `trashed: true`), while a permanently deleted one returns 404.
 */
export async function getDriveFolderState(
  accessToken: string,
  folderId: string
): Promise<DriveFolderState> {
  try {
    const response = await driveFetch(
      accessToken,
      `${API}/files/${encodeURIComponent(folderId)}?fields=id,trashed`
    )
    const data = (await response.json()) as { trashed?: boolean }
    return data.trashed ? 'trashed' : 'ok'
  } catch (error) {
    if (error instanceof DriveNotFoundError) return 'missing'
    throw error
  }
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
    q: `name = '${name.replaceAll("'", "\\'")}' and '${parentId}' in parents and mimeType != 'application/vnd.google-apps.folder' and trashed=false`,
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

export interface DriveAbout {
  email: string | null
  usageInDrive: number | null
}

export async function getDriveAbout(accessToken: string): Promise<DriveAbout> {
  const response = await driveFetch(
    accessToken,
    `${API}/about?fields=user(emailAddress),storageQuota(usageInDrive)`
  )
  const data = (await response.json()) as {
    user?: { emailAddress?: string }
    storageQuota?: { usageInDrive?: string }
  }
  const usage = data.storageQuota?.usageInDrive
  return {
    email: data.user?.emailAddress?.trim() || null,
    usageInDrive: usage === undefined ? null : Number(usage) || 0,
  }
}

export interface DriveStorageQuota {
  usageBytes: number
  limitBytes: number | null
}

export async function getDriveStorageQuota(
  accessToken: string
): Promise<DriveStorageQuota> {
  const response = await driveFetch(
    accessToken,
    `${API}/about?fields=storageQuota(usage,limit)`
  )
  const data = (await response.json()) as {
    storageQuota?: { usage?: string; limit?: string }
  }
  const limit = Number(data.storageQuota?.limit)
  return {
    usageBytes: Number(data.storageQuota?.usage) || 0,
    limitBytes: Number.isFinite(limit) && limit > 0 ? limit : null,
  }
}

export async function batchDeleteDriveFiles(
  accessToken: string,
  fileIds: string[]
): Promise<string[]> {
  const results = await batchDeleteDriveFileResults(accessToken, fileIds)
  return fileIds.filter((id) => {
    const status = results.get(id)?.status
    return status === undefined || (status >= 300 && status !== 404)
  })
}

export async function batchDeleteDriveFileResults(
  accessToken: string,
  fileIds: string[]
): Promise<Map<string, { status: number; body: string }>> {
  const {
    DRIVE_BATCH_LIMIT,
    buildBatchDeleteBody,
    hasBatchAuthFailure,
    parseBatchResults,
  } = await import('./drive-batch')
  const results = new Map<string, { status: number; body: string }>()
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
    const parts = parseBatchResults(await response.text(), ids)
    if (hasBatchAuthFailure(parts.values())) {
      throw new DriveAuthError('Drive rejected the access token in a batch')
    }
    for (const [id, result] of parts) {
      results.set(id, result)
    }
  }
  return results
}
