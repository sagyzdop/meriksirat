const ALBUM_TTL_SECONDS = 60
const ABOUT_TTL_SECONDS = 60 * 60

export function guestHtmlTtlSeconds(pathname: string): number | null {
  if (pathname === '/about') return ABOUT_TTL_SECONDS
  if (/^\/albums(?:\/[^/]+)?$/.test(pathname)) return ALBUM_TTL_SECONDS
  return null
}
