import { createServerFn } from '@tanstack/react-start'
import { UserError } from '@/lib/user-error'

export const sendTestEmailFn = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ sentTo: string }> => {
    const { adminContext } = await import('@/lib/admin/server')
    const { sendEmail } = await import('@/lib/google/email')

    const { admin } = await adminContext(['admin'])

    const sentAt = new Date().toISOString()
    const sent = await sendEmail({
      to: admin.email,
      subject: 'nu_image test email',
      text: `This is a test email from nu_image sent at ${sentAt}.`,
      html: `<p>This is a test email from <strong>nu_image</strong> sent at ${sentAt}.</p>`,
    })

    if (!sent) {
      throw new UserError('Failed to send test email. Check the server logs.')
    }

    return { sentTo: admin.email }
  }
)
