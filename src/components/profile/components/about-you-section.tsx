import { ProfileField } from './profile-field'
import type { UserProfile } from '@/lib/user/types'

type FieldProps = Parameters<typeof ProfileField>[0]

export function AboutYouSection({ user }: { user: UserProfile }) {
  const field = (
    fieldKey: FieldProps['fieldKey'],
    label: string,
    value: string,
    extra: Partial<FieldProps> = {}
  ) => (
    <ProfileField
      key={`${fieldKey}:${value}`}
      fieldKey={fieldKey}
      label={label}
      value={value}
      {...extra}
    />
  )

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">About you</h2>
      {field('firstName', 'First name', user.firstName ?? '')}
      {field('lastName', 'Last name', user.lastName ?? '')}
      {field('birthday', 'Birthday', user.birthday?.slice(0, 10) ?? '', {
        type: 'date',
      })}
      {field('major', 'Major', user.major ?? '', {
        placeholder: 'e.g. Computer Science',
      })}
      {field('graduationDate', 'Graduating', user.graduationDate ?? '', {
        type: 'month',
      })}
      {field('nuId', 'NU ID', user.nuId?.toString() ?? '', {
        type: 'number',
        placeholder: 'e.g. 202012345',
      })}
    </section>
  )
}
