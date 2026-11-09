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

export type AboutBlock =
  { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] }

export const ABOUT_TITLE = 'Keeping the Flame Alive'

const p = (text: string): AboutBlock => ({ type: 'p', text })

export function aboutCopy() {
  return {
    sections: [
      {
        id: 'club',
        title: 'NU Image',
        blocks: [
          p(
            'As you all know, NU Image is one of the oldest student organizations at Nazarbayev University. We capture moments from events of all sizes and organize photoshoots for almost every NU club. Our members work hard throughout each semester to preserve the memories of our university community.'
          ),
          p(
            "Back in the good old days, we used to publish our albums on Google Photos. When that option became unavailable, we moved to our club's Google Drive and connected this platform to make our photo archive even more accessible and convenient. However, starting this November, NU Google accounts are now limited to 20 GB of storage."
          ),
          p(
            'Since 2022, we have accumulated approximately 2.5 TB of photos. Keeping everything in a single account is no longer possible, and without a sustainable alternative, we risk losing access to years of university memories.'
          ),
          p(
            "We have explored different storage solutions, but unfortunately, none of the completely free options we found would be sustainable in the long run. That's why we're asking for your help."
          ),
        ] as AboutBlock[],
      },
      {
        id: 'flamekeepers',
        title: 'Meet Flamekeepers',
        blocks: [
          p(
            'The idea is simple: a little space from many people can preserve thousands of memories for everyone.'
          ),
          p(
            "Google Drive has an interesting feature: when someone uploads files to a folder shared with them, those files count toward the uploader's storage quota, rather than the folder owner's."
          ),
          p(
            "Flamekeepers uses this feature to distribute NU Image's photo archive across the unused storage space that students voluntarily contribute."
          ),
          p(
            'By becoming a Flamekeeper, you lend a small portion of your NU Google Drive storage to NU Image. In return, you help keep our photo albums online, accessible, and free for the entire university community.'
          ),
          p(
            "You don't need to upload photos, organize folders, or do anything manually. The app takes care of the process."
          ),
        ] as AboutBlock[],
      },
      {
        id: 'safety',
        title: 'Is My Google Drive Safe?',
        blocks: [
          p('Your privacy and security are our priority.'),
          p(
            'Flamekeepers uses limited Google Drive permissions. The app can only access and manage files that it creates itself.'
          ),
          p('This means:'),
          {
            type: 'ul',
            items: [
              'Your personal files remain private. Flamekeepers cannot read, modify, or delete your existing documents, photos, or folders.',
              'You choose how much storage to contribute. You are not giving away your entire Google Drive.',
              'You remain in control. You can stop participating whenever you wish.',
            ],
          },
          p(
            'Your contribution is simply a way to share a small amount of unused storage, not your personal files.'
          ),
        ] as AboutBlock[],
      },
      {
        id: 'albums',
        title: 'How Long Will the Albums Stay Available?',
        blocks: [
          p(
            'Our goal is to preserve as many memories as possible for as long as possible.'
          ),
          p(
            'Based on our estimates, if at least 3,000 students contribute 1 GB each, we can accommodate our existing archive and provide approximately another year of storage for new albums.'
          ),
          p(
            'However, we want to be transparent: we cannot promise that every album will remain online forever.'
          ),
          p(
            'As our archive continues to grow, older albums may eventually need to be removed to make room for new ones.'
          ),
          p(
            'Albums will remain available until they are scheduled for deletion by our administrators. When that happens, we will provide advance notice so that everyone has an opportunity to download the photos they want to keep.'
          ),
          p(
            'The more Flamekeepers join us, the longer we can preserve these memories.'
          ),
        ] as AboutBlock[],
      },
      {
        id: 'benefits',
        title: "What's in It for Me?",
        blocks: [
          p(
            "First and foremost, you're helping preserve the history of our university, including moments you and your friends may want to revisit years from now."
          ),
          p(
            'By signing in, you also unlock the ability to like your favorite albums and photos, making your experience with the NU Image archive more interactive.'
          ),
          p(
            'And perhaps most importantly, you become part of a community effort to keep our shared memories alive.'
          ),
        ] as AboutBlock[],
      },
      {
        id: 'help',
        title: 'How Can I Help?',
        blocks: [
          p("It's simple:"),
          {
            type: 'ol',
            items: [
              'Sign in using your NU Google account.',
              `Choose how much storage you're comfortable contributing, starting at ${formatMinPledge(MIN_PLEDGE_BYTES)}.`,
              "Become a Flamekeeper and help us preserve NU's memories.",
            ],
          },
          p('Even 1 GB can make a difference.'),
          p('You can stop being a Flamekeeper whenever you choose.'),
          p('Together, we can keep the flame alive.'),
        ] as AboutBlock[],
      },
    ],
  }
}
