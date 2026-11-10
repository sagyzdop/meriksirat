import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { format, parse } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DatePicker } from '@/components/ui/date-picker'
import { Input } from '@/components/ui/input'
import { Item, ItemActions, ItemContent, ItemTitle } from '@/components/ui/item'
import { GraduationMonthInput } from '@/components/shared/graduation-month-input'
import { useAsyncAction } from '@/hooks/use-async-action'
import { getTelegramUpdateLinkUrlFn } from '@/lib/auth/onboarding'
import { updateUserProfileFn } from '@/lib/user/functions'
import {
  profileFieldPayload,
  type ProfileFieldKey,
} from '@/lib/user/profile-fields'
import type { UserProfile } from '@/lib/user/types'
import { UserError } from '@/lib/user-error'

type Drafts = Record<ProfileFieldKey, string>

const LABELS: Record<ProfileFieldKey, string> = {
  firstName: 'First name',
  lastName: 'Last name',
  birthday: 'Birthday',
  major: 'Major',
  graduationDate: 'Graduating',
  nuId: 'NU ID',
  instagramUsername: 'Instagram',
}

function initialDrafts(user: UserProfile): Drafts {
  return {
    firstName: user.firstName ?? '',
    lastName: user.lastName ?? '',
    birthday: user.birthday?.slice(0, 10) ?? '',
    major: user.major ?? '',
    graduationDate: user.graduationDate ?? '',
    nuId: user.nuId?.toString() ?? '',
    instagramUsername: user.instagramUsername ?? '',
  }
}

export function PersonalInformationSection({ user }: { user: UserProfile }) {
  const router = useRouter()
  const initial = initialDrafts(user)
  const [drafts, setDrafts] = useState<Drafts>(initial)
  const [errors, setErrors] = useState<
    Partial<Record<ProfileFieldKey, string>>
  >({})
  const { pending: saving, run: runSave } = useAsyncAction()
  const { pending: relinking, run: runRelink } = useAsyncAction()

  const dirtyKeys = (Object.keys(drafts) as ProfileFieldKey[]).filter(
    (key) => drafts[key] !== initial[key]
  )

  const set = (key: ProfileFieldKey, value: string) =>
    setDrafts((current) => ({ ...current, [key]: value }))

  const save = () => {
    const nextErrors: Partial<Record<ProfileFieldKey, string>> = {}
    let payload = {}
    for (const key of dirtyKeys) {
      const result = profileFieldPayload(key, drafts[key])
      if (result.ok) payload = { ...payload, ...result.data }
      else nextErrors[key] = result.error
    }
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return
    return runSave(async () => {
      await updateUserProfileFn({ data: payload })
      toast.success('Personal information saved')
      await router.invalidate()
    }, 'Could not save personal information')
  }

  const relink = () =>
    runRelink(async () => {
      const { url } = await getTelegramUpdateLinkUrlFn()
      if (!url) throw new UserError('No Telegram link available')
      window.open(url, '_blank')
      toast.success('Open Telegram and tap Start to relink your username')
    }, 'Could not open Telegram')

  const row = (key: ProfileFieldKey, control: React.ReactNode) => (
    <Item variant="outline" size="sm">
      <ItemContent className="min-w-24">
        <ItemTitle>
          <label htmlFor={`profile-${key}`}>{LABELS[key]}</label>
        </ItemTitle>
        {errors[key] && (
          <p role="alert" className="text-sm text-destructive">
            {errors[key]}
          </p>
        )}
      </ItemContent>
      {control}
    </Item>
  )

  const text = (
    key: ProfileFieldKey,
    extra: React.ComponentProps<typeof Input> = {}
  ) =>
    row(
      key,
      <Input
        id={`profile-${key}`}
        className="w-full sm:w-56"
        value={drafts[key]}
        onChange={(event) => set(key, event.target.value)}
        aria-invalid={errors[key] ? true : undefined}
        {...extra}
      />
    )

  const birthday = drafts.birthday
    ? parse(drafts.birthday, 'yyyy-MM-dd', new Date())
    : undefined
  const thisYear = new Date().getFullYear()

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Personal Information</h2>
      {text('firstName')}
      {text('lastName')}
      {row(
        'birthday',
        <DatePicker
          id="profile-birthday"
          className="h-9 w-full sm:w-56"
          date={birthday}
          onSelect={(date) =>
            set('birthday', date ? format(date, 'yyyy-MM-dd') : '')
          }
          placeholder="Pick your birthday"
          captionLayout="dropdown"
          startMonth={new Date(thisYear - 80, 0)}
          endMonth={new Date(thisYear, 11)}
          defaultMonth={birthday ?? new Date(thisYear - 20, 0)}
        />
      )}
      {text('major', { placeholder: 'e.g. Computer Science' })}
      {row(
        'graduationDate',
        <GraduationMonthInput
          id="profile-graduationDate"
          className="w-full sm:w-56"
          value={drafts.graduationDate}
          onValueChange={(value) => set('graduationDate', value)}
        />
      )}
      {text('nuId', { inputMode: 'numeric', placeholder: 'e.g. 202012345' })}
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
        <ItemContent className="min-w-24">
          <ItemTitle>
            <label htmlFor="profile-telegram">Telegram</label>
          </ItemTitle>
        </ItemContent>
        <Input
          id="profile-telegram"
          className="w-full sm:w-56"
          value={
            user.telegramUsername ? `@${user.telegramUsername}` : 'Not linked'
          }
          disabled
        />
        {!user.telegramUsername && (
          <ItemActions>
            <Button
              size="sm"
              variant="outline"
              onClick={relink}
              disabled={relinking}
            >
              {relinking ? 'Opening...' : 'Link'}
            </Button>
          </ItemActions>
        )}
      </Item>
      {text('instagramUsername', { placeholder: 'username' })}
      <div className="flex justify-end pt-2">
        <Button
          onClick={() => void save()}
          disabled={saving || dirtyKeys.length === 0}
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </section>
  )
}
