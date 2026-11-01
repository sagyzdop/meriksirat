import { getGoogleAccessToken } from './google-calendar-auth'
import { buildGmailRaw, type EmailContent } from './gmail-mime'

const GMAIL_SEND_URL =
  'https://gmail.googleapis.com/gmail/v1/users/me/messages/send'

export async function sendEmail(input: EmailContent): Promise<boolean> {
  try {
    const accessToken = await getGoogleAccessToken()
    const response = await fetch(GMAIL_SEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: buildGmailRaw(input) }),
    })

    if (!response.ok) {
      console.error(
        `[email] Gmail send failed (${response.status}): ${await response.text()}`
      )
      return false
    }

    return true
  } catch (error) {
    console.error('[email] Failed to send email:', error)
    return false
  }
}
