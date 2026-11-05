import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  FileText,
  Flame,
  HelpCircle,
  ShieldCheck,
} from 'lucide-react'
import { authClient } from '@/lib/auth/auth-client'
import {
  ABOUT_LEGAL_LINKS,
  aboutCopy,
  becomeFlamekeeperPath,
} from '@/lib/about/content'
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
import { PublicAlbumsLayout } from '@/components/albums/public-layout'

const LEGAL_ICONS = [HelpCircle, FileText, ShieldCheck]

function BecomeFlamekeeperButton() {
  // The page itself reads nothing; the session is only probed in the browser
  // after load, so the cached HTML is identical for everyone.
  const { data: session } = authClient.useSession()
  const to = becomeFlamekeeperPath(Boolean(session))
  return (
    <Button asChild>
      <Link to={to}>Become a flamekeeper</Link>
    </Button>
  )
}

export function Page() {
  const { sections } = aboutCopy()
  return (
    <PublicAlbumsLayout>
      <article className="mx-auto max-w-xl px-6 py-20 pb-32">
        <Flame
          size={28}
          className="text-primary fill-primary/30 motion-safe:animate-pulse"
          aria-hidden="true"
        />
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">
          Keeping the flame alive
        </h1>
        <div className="mt-12 space-y-8">
          {sections.map((section) => (
            <section key={section.id} id={section.id} className="scroll-mt-20">
              <h2 className="text-2xl font-semibold">{section.title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">
                {section.body}
              </p>
              {section.id === 'help' && (
                <div className="mt-4">
                  <BecomeFlamekeeperButton />
                </div>
              )}
            </section>
          ))}
          <section id="more" className="scroll-mt-20">
            <h2 className="text-2xl font-semibold">Help and legal</h2>
            <ItemGroup className="mt-2">
              {ABOUT_LEGAL_LINKS.map((link, index) => {
                const Icon = LEGAL_ICONS[index]
                return (
                  <div key={link.title}>
                    {index > 0 && <ItemSeparator />}
                    <Item asChild>
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ItemMedia>
                          <Icon className="size-4 text-muted-foreground" />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>{link.title}</ItemTitle>
                          <ItemDescription>{link.description}</ItemDescription>
                        </ItemContent>
                        <ArrowUpRight className="size-4 text-muted-foreground" />
                      </a>
                    </Item>
                  </div>
                )
              })}
            </ItemGroup>
          </section>
        </div>
      </article>
    </PublicAlbumsLayout>
  )
}
