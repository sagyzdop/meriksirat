import { useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from '@/components/ui/item'
import { GraduationMonthInput } from '@/components/shared/graduation-month-input'
import { useAsyncAction } from '@/hooks/use-async-action'
import { updateUserProfileFn } from '@/lib/user/functions'
import {
  profileFieldPayload,
  type ProfileFieldKey,
} from '@/lib/user/profile-fields'

interface ProfileFieldProps {
  fieldKey: ProfileFieldKey
  label: string
  value: string
  type?: 'text' | 'number' | 'date' | 'month'
  placeholder?: string
  description?: string
}

export function ProfileField({
  fieldKey,
  label,
  value,
  type = 'text',
  placeholder,
  description,
}: ProfileFieldProps) {
  const router = useRouter()
  const [draft, setDraft] = useState(value)
  const [error, setError] = useState<string | null>(null)
  const { pending, run } = useAsyncAction()
  const dirty = draft !== value
  const inputId = `profile-${fieldKey}`

  const save = () => {
    const result = profileFieldPayload(fieldKey, draft)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setError(null)
    return run(async () => {
      await updateUserProfileFn({ data: result.data })
      toast.success(`${label} saved`)
      await router.invalidate()
    }, `Could not save ${label.toLowerCase()}`)
  }

  return (
    <Item variant="outline" size="sm">
      <ItemContent className="min-w-24">
        <ItemTitle>
          <label htmlFor={inputId}>{label}</label>
        </ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </ItemContent>
      <form
        className="flex w-full items-center gap-2 sm:w-auto"
        onSubmit={(event) => {
          event.preventDefault()
          if (dirty) void save()
        }}
      >
        {type === 'month' ? (
          <GraduationMonthInput
            id={inputId}
            className="w-full sm:w-56"
            value={draft}
            onValueChange={setDraft}
          />
        ) : (
          <Input
            id={inputId}
            className="w-full sm:w-56"
            type={type}
            inputMode={type === 'number' ? 'numeric' : undefined}
            value={draft}
            placeholder={placeholder}
            onChange={(event) => setDraft(event.target.value)}
            aria-invalid={error ? true : undefined}
          />
        )}
        {dirty && (
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? 'Saving...' : 'Save'}
          </Button>
        )}
      </form>
    </Item>
  )
}
