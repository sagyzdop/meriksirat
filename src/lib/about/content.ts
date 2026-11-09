import { MIN_PLEDGE_BYTES, TERMS_URL } from '@/lib/flamekeeper/rules'

const MB = 1024 * 1024
const GB = 1024 * MB

const DOCS_BASE = 'https://github.com/sagyzdop/meriksirat/blob/main/docs'

export const ABOUT_LEGAL_LINKS = [
  {
    title: 'FAQ',
    description: 'Accounts, albums, bookings and flamekeeping.',
    href: `${DOCS_BASE}/faq.md`,
  },
  {
    title: 'Terms of Service',
    description: 'What you agree to when you use the site.',
    href: TERMS_URL,
  },
  {
    title: 'Privacy Policy',
    description: 'What we store and why.',
    href: `${DOCS_BASE}/privacy-policy.md`,
  },
] as const

export const BECOME_FLAMEKEEPER_PATH = '/become-flamekeeper'

export function formatMinPledge(bytes: number): string {
  if (bytes >= GB) return `${Math.round((bytes / GB) * 10) / 10} GB`
  return `${Math.round(bytes / MB)} MB`
}

export function aboutCopy() {
  return {
    sections: [
      {
        id: 'club',
        title: 'The club',
        body: "NU Image is the university's student photography club. Our photos lived on one club Google account until NU limited every account to 20 GB. The archive no longer fit, so we asked for help.",
      },
      {
        id: 'flamekeepers',
        title: 'Flamekeepers',
        body: `Flamekeepers are students who lend a small part of their own NU Drive to the club. Each pledge, starting at ${formatMinPledge(MIN_PLEDGE_BYTES)}, helps keep the albums online and free for everyone to see.`,
      },
      {
        id: 'albums',
        title: 'How long albums last',
        body: 'Albums stay up until they are deleted. If an album is scheduled for deletion, it is deleted only after the notice period, so there is time to download it.',
      },
      {
        id: 'help',
        title: 'How to help',
        body: "Sign in with your NU Google account and pledge what you can spare. The app can only touch the files it creates, and you can stop whenever you like. There's nothing else to do.",
      },
    ],
  }
}
