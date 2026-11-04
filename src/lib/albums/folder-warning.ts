import type { DriveFolderState } from '@/lib/google/google-drive'

export type FolderCheckVerdict = 'missing' | 'exists' | 'unknown'

export function folderCheckVerdict(
  outcome: { state: DriveFolderState } | { error: unknown }
): FolderCheckVerdict {
  if (!('state' in outcome)) return 'unknown'
  return outcome.state === 'missing' ? 'missing' : 'exists'
}

export interface FolderWarning {
  title: string
  description: string
  canDelete: boolean
}

export function folderWarning(
  state: DriveFolderState,
  viewer: { isAdmin: boolean }
): FolderWarning | null {
  if (state === 'trashed') {
    return {
      title: 'Album folder is in the Google Drive bin',
      description:
        'The folder behind this album was moved to the bin in Drive. Uploads are paused and photos may not show.',
      canDelete: false,
    }
  }
  if (state === 'missing') {
    return {
      title: 'Album folder deleted from Google Drive',
      description:
        'The folder behind this album was permanently deleted. Uploads are paused and its photos can no longer be shown.',
      canDelete: viewer.isAdmin,
    }
  }
  return null
}

export function canDeleteGoneAlbum(
  verdict: FolderCheckVerdict,
  viewer: { isAdmin: boolean }
): { ok: true } | { ok: false; message: string } {
  if (!viewer.isAdmin) {
    return { ok: false, message: 'Only an admin can delete this album.' }
  }
  if (verdict === 'exists') {
    return {
      ok: false,
      message:
        'The album folder still exists in Google Drive, so the album was not deleted.',
    }
  }
  if (verdict === 'unknown') {
    return {
      ok: false,
      message:
        'Could not confirm that the album folder is deleted. Nothing was changed. Please try again later.',
    }
  }
  return { ok: true }
}
