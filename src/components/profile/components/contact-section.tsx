import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { useAsyncAction } from '@/hooks/use-async-action'
import { getTelegramUpdateLinkUrlFn } from '@/lib/auth/onboarding'
import { ProfileField } from './profile-field'
import type { UserProfile } from '@/lib/user/types'

export function ContactSection({ user }: { user: UserProfile }) {
  const { pending, run } = useAsyncAction()

  const relink = () =>
    run(async () => {
      const { url } = await getTelegramUpdateLinkUrlFn()
      if (!url) throw new Error('No Telegram link available')
      window.open(url, '_blank')
      toast.success('Open Telegram and tap Start to relink your username')
    }, 'Could not open Telegram')

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Contact</h2>
      <Item variant="outline" size="sm">
        <ItemContent className="min-w-24">
          <ItemTitle>
            <label htmlFor="profile-email">Email</label>
          </ItemTitle>
        </ItemContent>
        <Input
          id="profile-email"
          className="w-full sm:w-56"
          type="email"
          value={user.email}
          disabled
        />
      </Item>
      <Item variant="outline" size="sm">
        <ItemContent>
          <ItemTitle>Telegram</ItemTitle>
          <ItemDescription>
            {user.telegramUsername ? `@${user.telegramUsername}` : 'Not linked'}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            size="sm"
            variant="outline"
            onClick={relink}
            disabled={pending}
          >
            {pending ? 'Opening...' : 'Relink'}
          </Button>
        </ItemActions>
      </Item>
      <ProfileField
        key={`instagramUsername:${user.instagramUsername ?? ''}`}
        fieldKey="instagramUsername"
        label="Instagram"
        value={user.instagramUsername ?? ''}
        placeholder="username"
      />
    </section>
  )
}
