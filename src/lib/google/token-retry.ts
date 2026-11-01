import { DriveAuthError } from './google-drive'

export interface TokenSource {
  getToken: () => Promise<string>
  forget: () => void
  hasCached?: () => boolean
  canRetry?: () => boolean
}

export async function withTokenRetry<T>(
  source: TokenSource,
  run: (token: string) => Promise<T>
): Promise<T> {
  const wasCached = source.hasCached ? source.hasCached() : true
  const token = await source.getToken()
  try {
    return await run(token)
  } catch (error) {
    if (!(error instanceof DriveAuthError) || !wasCached) throw error
    if (source.canRetry && !source.canRetry()) throw error
    source.forget()
    return run(await source.getToken())
  }
}
