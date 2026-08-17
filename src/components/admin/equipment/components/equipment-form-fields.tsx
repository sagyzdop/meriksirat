import type { UseFormReturn } from 'react-hook-form'
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type EquipmentFormFields = {
  modelName: string
  shortName?: string
  description?: string
  categoryId: number
  googleCalendarId: string
  requiredClearanceLevel: number
}

interface EquipmentFormFieldsProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>
  categories: Array<{
    id: number
    name: string
  }>
  disabled?: boolean
}

/**
 * Shared equipment form fields used by both the create and edit admin pages.
 * Uses `any` for the form prop because the two pages have different schema
 * types (create vs. edit with isActive). This is the idiomatic react-hook-form
 * pattern for shared form components across different schemas.
 */
export function EquipmentFormFields({
  form,
  categories,
  disabled,
}: EquipmentFormFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="modelName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Model Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., Canon EOS R5, Sony A7 IV"
                  {...field}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="shortName"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Short Name</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g., R5, A7IV"
                  {...field}
                  disabled={disabled}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={form.control}
        name="description"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Description</FormLabel>
            <FormControl>
              <Textarea
                placeholder="Equipment description..."
                className="min-h-[80px]"
                {...field}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="categoryId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Category *</FormLabel>
            <Select
              onValueChange={(value) => field.onChange(Number(value))}
              value={field.value ? String(field.value) : ''}
              disabled={disabled}
            >
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="requiredClearanceLevel"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Required Clearance Level *</FormLabel>
            <FormControl>
              <Input
                type="number"
                min={1}
                max={10}
                placeholder="1"
                value={field.value}
                onChange={(e) => field.onChange(Number(e.target.value))}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={form.control}
        name="googleCalendarId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Google Calendar ID *</FormLabel>
            <FormControl>
              <Input
                placeholder="calendar@group.calendar.google.com"
                {...field}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
