import { google } from 'googleapis'
import type { calendar_v3 } from 'googleapis/build/src/apis/calendar/v3'

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const refreshToken = process.env.GOOGLE_MASTER_REFRESH_TOKEN

  if (!clientId) throw new Error('GOOGLE_CLIENT_ID not set')
  if (!clientSecret) throw new Error('GOOGLE_CLIENT_SECRET not set')
  if (!refreshToken) throw new Error('GOOGLE_MASTER_REFRESH_TOKEN not set')

  // Create a new OAuth2 client for each request (important for serverless)
  const oauth2Client = new google.auth.OAuth2(
    clientId,
    clientSecret,
    process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000'
  )

  // Use setCredentials method as recommended by Google
  oauth2Client.setCredentials({
    refresh_token: refreshToken,
  })

  return oauth2Client
}

export function getCalendarClient(): calendar_v3.Calendar {
  const auth = getOAuth2Client()
  return google.calendar({ version: 'v3', auth })
}
