// PROTOTYPE: three About page layouts. Static, no data. Copy is a draft.
import { ArrowUpRight, FileText, HelpCircle, ShieldCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import { FlameMotif } from './flame-motif'

const LINKS = [
  {
    title: 'FAQ',
    description: 'Accounts, albums, bookings and flamekeeping.',
    href: 'https://github.com/sagyzdop/meriksirat/blob/main/docs/faq.md',
    icon: HelpCircle,
  },
  {
    title: 'Terms of Service',
    description: 'What you agree to when you use the site.',
    href: 'https://github.com/sagyzdop/meriksirat/blob/main/docs/terms-of-service.md',
    icon: FileText,
  },
  {
    title: 'Privacy Policy',
    description: 'What we store and why.',
    href: 'https://github.com/sagyzdop/meriksirat/blob/main/docs/privacy-policy.md',
    icon: ShieldCheck,
  },
]

const STORY =
  "NU Image is the university's student photography club. Our photos lived on one club Google account until NU limited every account to 20 GB. The archive no longer fit, so we asked for help."
const IDEA =
  'Flamekeepers are students who lend a small part of their own NU Drive to the club. Each pledge, starting at 512 MB, helps keep the albums online and free for everyone to see.'
const EXPIRY =
  'Albums stay up for two years after the event. Owners are reminded 30 and 7 days before an album goes, so there is time to download it. Admins can pin the albums worth keeping longer.'
const HELP =
  "Sign in with your NU Google account and pledge what you can spare. The app can only touch the files it creates, and you can stop whenever you like. There's nothing else to do."

function LinkList() {
  return (
    <ItemGroup>
      {LINKS.map((link, index) => (
        <div key={link.title}>
          {index > 0 && <ItemSeparator />}
          <Item asChild>
            <a href={link.href} target="_blank" rel="noopener noreferrer">
              <ItemMedia>
                <link.icon className="size-4 text-muted-foreground" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{link.title}</ItemTitle>
                <ItemDescription>{link.description}</ItemDescription>
              </ItemContent>
              <ArrowUpRight className="size-4 text-muted-foreground" />
            </a>
          </Item>
        </div>
      ))}
    </ItemGroup>
  )
}

function Cta() {
  return (
    <Button asChild>
      <a href="/profile">Become a flamekeeper</a>
    </Button>
  )
}

export function VariantA() {
  return (
    <article className="mx-auto max-w-xl px-6 py-20 pb-32">
      <FlameMotif state="flame" size={28} />
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">
        Keeping the flame alive
      </h1>
      <div className="mt-8 space-y-5 text-lg leading-relaxed">
        <p>{STORY}</p>
        <p>{IDEA}</p>
        <p className="text-muted-foreground">{EXPIRY}</p>
        <p>{HELP}</p>
      </div>
      <div className="mt-8">
        <Cta />
      </div>
      <div className="mt-16">
        <LinkList />
      </div>
    </article>
  )
}

const SECTIONS = [
  { id: 'club', title: 'The club', body: STORY },
  { id: 'flamekeepers', title: 'Flamekeepers', body: IDEA },
  { id: 'albums', title: 'How long albums last', body: EXPIRY },
  { id: 'help', title: 'How to help', body: HELP },
]

export function VariantB() {
  return (
    <div className="mx-auto grid max-w-4xl gap-12 px-6 py-16 pb-32 md:grid-cols-[180px_1fr]">
      <nav className="md:sticky md:top-16 md:self-start">
        <p className="flex items-center gap-2 font-semibold">
          <FlameMotif state="flame" size={14} />
          About
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="hover:text-foreground">
                {section.title}
              </a>
            </li>
          ))}
          <li>
            <a href="#more" className="hover:text-foreground">
              Help and legal
            </a>
          </li>
        </ul>
      </nav>
      <div className="space-y-12">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-16">
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {section.body}
            </p>
            {section.id === 'help' && (
              <div className="mt-4">
                <Cta />
              </div>
            )}
          </section>
        ))}
        <section id="more" className="scroll-mt-16">
          <h2 className="text-2xl font-semibold">Help and legal</h2>
          <div className="mt-2">
            <LinkList />
          </div>
        </section>
      </div>
    </div>
  )
}

export function VariantD() {
  return (
    <article className="mx-auto max-w-xl px-6 py-20 pb-32">
      <FlameMotif state="flame" size={28} />
      <h1 className="mt-6 text-4xl font-semibold tracking-tight">
        Keeping the flame alive
      </h1>
      <div className="mt-12 space-y-12">
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-16">
            <h2 className="text-2xl font-semibold">{section.title}</h2>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {section.body}
            </p>
            {section.id === 'help' && (
              <div className="mt-4">
                <Cta />
              </div>
            )}
          </section>
        ))}
        <section id="more" className="scroll-mt-16">
          <h2 className="text-2xl font-semibold">Help and legal</h2>
          <div className="mt-2">
            <LinkList />
          </div>
        </section>
      </div>
    </article>
  )
}

export function VariantC() {
  return (
    <div className="pb-32">
      <header className="flex min-h-[70vh] flex-col items-center justify-center bg-neutral-950 px-6 text-center text-white">
        <FlameMotif state="flame" size={96} />
        <h1 className="mt-10 max-w-2xl text-5xl font-semibold tracking-tight md:text-6xl">
          Every photo here is kept alive by someone.
        </h1>
        <p className="mt-6 max-w-lg text-lg text-white/70">{IDEA}</p>
        <div className="mt-8">
          <Cta />
        </div>
      </header>
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-10 py-16 md:grid-cols-3">
          <div>
            <FlameMotif state="ember" size={26} />
            <h2 className="mt-4 text-xl font-semibold">Why it exists</h2>
            <p className="mt-2 text-muted-foreground">{STORY}</p>
          </div>
          <div>
            <FlameMotif state="flame" size={26} />
            <h2 className="mt-4 text-xl font-semibold">How to help</h2>
            <p className="mt-2 text-muted-foreground">{HELP}</p>
          </div>
          <div>
            <FlameMotif state="fading" size={26} />
            <h2 className="mt-4 text-xl font-semibold">How long albums last</h2>
            <p className="mt-2 text-muted-foreground">{EXPIRY}</p>
          </div>
        </div>
        <div className="mx-auto max-w-xl">
          <LinkList />
        </div>
      </div>
    </div>
  )
}
