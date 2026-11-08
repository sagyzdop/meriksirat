import { BUFFER_SCOPE } from './grant-rules'

export function buildBufferAuthUrl(params: {
  clientId: string
  redirectUri: string
  state: string
}): string {
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  url.searchParams.set('client_id', params.clientId)
  url.searchParams.set('redirect_uri', params.redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', [BUFFER_SCOPE, 'openid', 'email'].join(' '))
  url.searchParams.set('access_type', 'offline')
  url.searchParams.set('prompt', 'select_account consent')
  url.searchParams.set('state', params.state)
  return url.toString()
}
