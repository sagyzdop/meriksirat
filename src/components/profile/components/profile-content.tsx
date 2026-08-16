import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Shield } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from '@/components/ui/field'
import { updateUserProfileFn } from '@/lib/user/functions'
import { getTelegramUpdateLinkUrlFn } from '@/lib/auth/onboarding'
import { useRouter } from '@tanstack/react-router'
import type { UserProfile } from '@/lib/user/types'
import { toDateOnlyString } from '@/lib/format'
import DatePicker from '@/components/shared/date-picker'

interface ProfileContentProps {
  user: UserProfile
}

const profileFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  instagramUsername: z.string().optional(),
  birthday: z.date().optional(),
  major: z.string().optional(),
  graduationYear: z.string().optional(),
  nuId: z.string().optional(),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

export function ProfileContent({ user }: ProfileContentProps) {
  const router = useRouter()
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingTelegram, setIsUpdatingTelegram] = useState(false)

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      instagramUsername: user.instagramUsername || '',
      birthday: user.birthday ? new Date(user.birthday) : undefined,
      major: user.major || '',
      graduationYear: user.graduationYear?.toString() || '',
      nuId: user.nuId?.toString() || '',
    },
  })

  const handleUpdateTelegram = async () => {
    setIsUpdatingTelegram(true)
    try {
      const { url } = await getTelegramUpdateLinkUrlFn()
      if (!url) {
        throw new Error('No Telegram link available')
      }
      window.open(url, '_blank')
      toast.success(
        'Open Telegram and tap Start to update your linked username'
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to open Telegram'
      )
    } finally {
      setIsUpdatingTelegram(false)
    }
  }

  const onSubmit = async (data: ProfileFormValues) => {
    setIsSaving(true)
    try {
      const updateData = {
        ...data,
        birthday: data.birthday ? toDateOnlyString(data.birthday) : undefined,
        graduationYear:
          data.graduationYear && data.graduationYear !== ''
            ? Number(data.graduationYear)
            : undefined,
        nuId: data.nuId && data.nuId !== '' ? Number(data.nuId) : undefined,
      }

      await updateUserProfileFn({ data: updateData })
      toast.success('Profile updated successfully')
      setIsEditing(false)
      router.invalidate()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update profile'
      )
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    form.reset()
    setIsEditing(false)
  }

  return (
    <Tabs defaultValue="editable" className="space-y-4">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="editable">Editable Information</TabsTrigger>
        <TabsTrigger value="admin">Admin Managed</TabsTrigger>
      </TabsList>

      {/* Editable Information */}
      <TabsContent value="editable">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  Update your personal details and profile information.
                </CardDescription>
              </div>
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={form.handleSubmit(onSubmit)}
                    disabled={isSaving}
                  >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="firstName">
                    First Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="firstName"
                    {...form.register('firstName')}
                    disabled={!isEditing}
                  />
                  <FieldError>
                    {form.formState.errors.firstName?.message}
                  </FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="lastName">
                    Last Name <span className="text-destructive">*</span>
                  </FieldLabel>
                  <Input
                    id="lastName"
                    {...form.register('lastName')}
                    disabled={!isEditing}
                  />
                  <FieldError>
                    {form.formState.errors.lastName?.message}
                  </FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="birthday">Birthday</FieldLabel>
                  <Controller
                    name="birthday"
                    control={form.control}
                    render={({ field }) => (
                      <DatePicker
                        value={field.value}
                        onChange={field.onChange}
                        disabled={!isEditing}
                      />
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="instagramUsername">
                    Instagram Username
                  </FieldLabel>
                  <Input
                    id="instagramUsername"
                    placeholder="username"
                    {...form.register('instagramUsername')}
                    disabled={!isEditing}
                  />
                  <FieldDescription>Without the @ symbol</FieldDescription>
                </Field>

                <Field>
                  <FieldLabel htmlFor="major">Major</FieldLabel>
                  <Input
                    id="major"
                    placeholder="e.g., Computer Science"
                    {...form.register('major')}
                    disabled={!isEditing}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="graduationYear">
                    Graduation Year
                  </FieldLabel>
                  <Input
                    id="graduationYear"
                    type="number"
                    placeholder="e.g., 2025"
                    {...form.register('graduationYear')}
                    disabled={!isEditing}
                  />
                  <FieldError>
                    {form.formState.errors.graduationYear?.message}
                  </FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="nuId">NU ID</FieldLabel>
                  <Input
                    id="nuId"
                    type="number"
                    placeholder="e.g., 123456"
                    {...form.register('nuId')}
                    disabled={!isEditing}
                  />
                  <FieldDescription>Your university ID number</FieldDescription>
                  <FieldError>{form.formState.errors.nuId?.message}</FieldError>
                </Field>

                <Field>
                  <FieldLabel htmlFor="email">Email</FieldLabel>
                  <Input id="email" type="email" value={user.email} disabled />
                  <FieldDescription>Email cannot be changed</FieldDescription>
                </Field>

                <Field className="md:col-span-2">
                  <FieldLabel htmlFor="telegramUsername">
                    Telegram Username
                  </FieldLabel>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Input
                      id="telegramUsername"
                      value={
                        user.telegramUsername ? `@${user.telegramUsername}` : ''
                      }
                      placeholder="Not connected"
                      disabled
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleUpdateTelegram}
                      disabled={isUpdatingTelegram}
                      className="shrink-0"
                    >
                      {isUpdatingTelegram ? 'Opening...' : 'Update Telegram'}
                    </Button>
                  </div>
                  <FieldDescription>
                    Set by your Telegram account. Tap the button and Start in
                    the bot to re-link it
                  </FieldDescription>
                </Field>
              </div>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      {/* Admin Managed Information */}
      <TabsContent value="admin">
        <Card>
          <CardHeader>
            <CardTitle>Admin Managed Information</CardTitle>
            <CardDescription>
              These settings are managed by administrators and cannot be changed
              by users.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Account Status</Label>
                <p className="text-muted-foreground text-sm">
                  Your current membership status
                </p>
              </div>
              <Badge
                variant={user.status === 'Active' ? 'default' : 'secondary'}
              >
                {user.status || 'Unknown'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Role</Label>
                <p className="text-muted-foreground text-sm">
                  Your access level in the system
                </p>
              </div>
              <Badge variant="outline">
                {user.role === 'admin'
                  ? 'Admin'
                  : user.role === 'manager'
                    ? 'Manager'
                    : user.role
                      ? 'Member'
                      : 'No Role'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Clearance Level</Label>
                <p className="text-muted-foreground text-sm">
                  Equipment access clearance
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Shield className="size-4 text-muted-foreground" />
                <Badge variant="secondary">
                  Level {user.clearanceLevel || 1}
                </Badge>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Email Verification</Label>
                <p className="text-muted-foreground text-sm">
                  Email verification status
                </p>
              </div>
              <Badge variant={user.emailVerified ? 'default' : 'destructive'}>
                {user.emailVerified ? 'Verified' : 'Not Verified'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Telegram</Label>
                <p className="text-muted-foreground text-sm">
                  {user.telegramUsername
                    ? `@${user.telegramUsername}`
                    : 'Not connected'}
                </p>
              </div>
              <Badge variant={user.telegramChatId ? 'default' : 'secondary'}>
                {user.telegramChatId ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label className="text-base">Google Account</Label>
                <p className="text-muted-foreground text-sm">
                  {user.googleId
                    ? 'Connected for authentication'
                    : 'Not connected'}
                </p>
              </div>
              <Badge variant={user.googleId ? 'default' : 'secondary'}>
                {user.googleId ? 'Connected' : 'Not Connected'}
              </Badge>
            </div>
            <Separator />
            <div className="py-2 space-y-2">
              <div className="space-y-0.5">
                <Label className="text-base">Account Created</Label>
                <p className="text-muted-foreground text-sm">
                  {new Date(user.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
              <div className="space-y-0.5">
                <Label className="text-base">Last Updated</Label>
                <p className="text-muted-foreground text-sm">
                  {new Date(user.updatedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  )
}
