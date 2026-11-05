import { Link } from '@tanstack/react-router'
import { Instagram, Send } from 'lucide-react'
import { authClient } from '@/lib/auth/auth-client'
import { useLogout } from '@/hooks/use-logout'
import type { UserProfile } from '@/lib/user/types'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/sonner'
import { BirthdayWishDrawer } from '@/components/shared/birthday-wish-drawer'
import { FlamekeeperInvitation } from '@/components/shared/flamekeeper-invitation'
import { ThemeToggle } from '@/components/shared/theme-toggle'
import { UserMenu, type UserMenuUser } from '@/components/shared/user-menu'

const CLUB_INSTAGRAM = 'https://www.instagram.com/nu_img'
const CLUB_TELEGRAM = 'https://t.me/nu_img'

export function PublicAlbumsHeader({
  menuUser,
  onLogout,
}: {
  menuUser: UserMenuUser | null
  onLogout: () => void
}) {
  return (
    <header className="sticky top-0 z-30 border-b bg-background">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 md:px-8">
        <Link
          to="/albums"
          className="flex min-w-0 items-center gap-2.5 font-medium"
          aria-label="NU Image home"
        >
          <img
            src="/logo.png"
            alt="NU Image logo"
            className="size-8 shrink-0 rounded-md object-contain"
          />
          <span className="truncate text-lg font-semibold tracking-tight">
            NU Image
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            to="/about"
            className="text-sm text-muted-foreground underline transition-colors hover:text-primary"
          >
            About
          </Link>
          <ThemeToggle />
          {menuUser ? (
            <UserMenu user={menuUser} onLogout={onLogout} />
          ) : (
            <Button asChild size="sm">
              <Link to="/login">Login</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}

export function PublicAlbumsFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-7xl items-center justify-items-center gap-3 px-4 py-4 md:h-16 md:grid-cols-2 md:py-0 md:px-8">
        <p className="text-sm text-muted-foreground md:justify-self-start">
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
        <div className="flex items-center gap-4 md:justify-self-end">
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
  user?: UserProfile | null
}

export function PublicAlbumsLayout({
  children,
  user,
}: PublicAlbumsLayoutProps) {
  const onLogout = useLogout()
  // Pages that don't load the user (like About) fall back to the browser
  // session; the invitation then waits until the session is known.
  const { data: session, isPending } = authClient.useSession()
  const known = user !== undefined
  const account = known
    ? user
    : session
      ? {
          name: session.user.name,
          email: session.user.email,
          image: session.user.image ?? null,
          firstName: null,
          lastName: null,
        }
      : null

  const showInvitation = known || (!isPending && !session)

  const menuUser: UserMenuUser | null = account
    ? {
        name:
          [account.firstName, account.lastName].filter(Boolean).join(' ') ||
          account.name ||
          account.email,
        email: account.email,
        avatar: account.image ?? '',
      }
    : null

  const invitationUser = user
    ? {
        ...user,
        role: (user.role as 'user' | 'manager' | 'admin' | null) ?? null,
      }
    : null

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <PublicAlbumsHeader menuUser={menuUser} onLogout={onLogout} />
      <main className="flex-1">{children}</main>
      <PublicAlbumsFooter />
      <Toaster />
      {user && <BirthdayWishDrawer userId={user.id} />}
      {showInvitation && <FlamekeeperInvitation user={invitationUser} />}
    </div>
  )
}
