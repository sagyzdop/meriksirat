import type { UseFormReturn } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { FieldGroup } from '@/components/ui/field'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import DatePicker from '@/components/shared/date-picker'

interface ProfileStepProps {
  form: UseFormReturn<any>
  error: string | null
  onSubmit: (data: any) => void
}

export function ProfileStep({ form, error, onSubmit }: ProfileStepProps) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FieldGroup>
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your first name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your last name" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="birthday"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date of Birth</FormLabel>
                <FormControl>
                  <DatePicker value={field.value} onChange={field.onChange} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="wantsBirthdayCongratulation"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    I want to be congratulated on my birthday!
                  </FormLabel>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nuId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>NU ID</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter your NU ID"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="major"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Major</FormLabel>
                <FormControl>
                  <Input placeholder="Enter your major" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="graduationYear"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Graduation Year</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="Enter your graduation year"
                    {...field}
                    onChange={(e) => field.onChange(e.target.value)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="instagramUsername"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Instagram Username (Optional)</FormLabel>
                <FormControl>
                  <Input placeholder="without @" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </FieldGroup>

        <Button
          type="submit"
          className="w-full"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting
            ? 'Completing...'
            : 'Complete Onboarding'}
        </Button>

        {error && (
          <div className="text-center text-sm text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}
      </form>
    </Form>
  )
}
