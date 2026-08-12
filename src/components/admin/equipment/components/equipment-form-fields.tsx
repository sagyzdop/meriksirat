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

interface EquipmentFormFieldsProps {
  form: UseFormReturn<any>
  categories: any[]
  disabled?: boolean
}

/**
 * Shared equipment form fields used by both the create and edit admin pages:
 * model name, short name, description, category, required clearance level, and
 * Google Calendar ID.
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
                  placeholder="e.g., R5, A7IV (optional)"
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
                placeholder="Detailed description of the equipment, specifications, included accessories, etc."
                className="min-h-[100px]"
                {...field}
                disabled={disabled}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <FormField
          control={form.control}
          name="categoryId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Category *</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(parseInt(value))}
                value={field.value?.toString()}
                disabled={disabled}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {[...categories]
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map((category) => (
                      <SelectItem
                        key={category.id}
                        value={category.id.toString()}
                      >
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
                  min="1"
                  max="10"
                  placeholder="1-10"
                  {...field}
                  onChange={(e) =>
                    field.onChange(parseInt(e.target.value) || 1)
                  }
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
        name="googleCalendarId"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Google Calendar ID *</FormLabel>
            <FormControl>
              <Input
                placeholder="e.g., equipment-camera-01@example.com"
                {...field}
                disabled={disabled}
              />
            </FormControl>
            <p className="text-sm text-muted-foreground">
              Each equipment must have a unique Google Calendar ID for booking
              management
            </p>
            <FormMessage />
          </FormItem>
        )}
      />
    </>
  )
}
