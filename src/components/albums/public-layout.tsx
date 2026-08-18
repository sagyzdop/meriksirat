import { Link } from '@tanstack/react-router'
import { Instagram, Send } from 'lucide-react'

const CLUB_INSTAGRAM = 'https://www.instagram.com/nu_img'
const CLUB_TELEGRAM = 'https://t.me/nu_img'

export function PublicAlbumsHeader() {
  return (
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link
          to="/albums"
          className="flex min-w-0 items-center gap-2.5 font-medium"
          aria-label="NU Image Albums home"
        >
          <img
            src="/logo.png"
            alt="NU Image logo"
            className="size-8 shrink-0 rounded-md object-contain"
          />
          <span className="truncate text-lg font-semibold tracking-tight">
            NU Image Albums
          </span>
        </Link>
      </div>
    </header>
  )
}

export function PublicAlbumsFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <p className="shrink-0 text-sm text-muted-foreground">
          Made by{' '}
          <a
            href="https://sagyzdop.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-primary"
          >
            sagyzdop
          </a>
        </p>
        <div className="flex shrink-0 items-center gap-4">
          <span className="text-sm text-muted-foreground">Follow NU Image</span>
          <a
            href={CLUB_INSTAGRAM}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NU Image on Instagram"
            title="Instagram"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <Instagram className="size-5" aria-hidden="true" />
          </a>
          <a
            href={CLUB_TELEGRAM}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="NU Image on Telegram"
            title="Telegram"
            className="text-muted-foreground transition-colors hover:text-primary"
          >
            <Send className="size-5" aria-hidden="true" />
          </a>
        </div>
      </div>
    </footer>
  )
}

interface PublicAlbumsLayoutProps {
  children: React.ReactNode
}

export function PublicAlbumsLayout({ children }: PublicAlbumsLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicAlbumsHeader />
      <main className="flex-1">{children}</main>
      <PublicAlbumsFooter />
    </div>
  )
}
