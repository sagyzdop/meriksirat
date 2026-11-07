import DatePicker from '@/components/shared/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

export interface AlbumFormValues {
  title: string
  event: string
  eventDate: Date | undefined
  description: string
}

export const isAlbumFormComplete = (values: AlbumFormValues) =>
  !!values.title.trim() && !!values.event.trim()

interface AlbumFormFieldsProps {
  idPrefix: string
  values: AlbumFormValues
  onChange: (patch: Partial<AlbumFormValues>) => void
  hints?: boolean
  eventDateError?: boolean
}

export function AlbumFormFields({
  idPrefix,
  values,
  onChange,
  hints,
  eventDateError,
}: AlbumFormFieldsProps) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-title`}>Title</Label>
        <Input
          id={`${idPrefix}-title`}
          value={values.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={hints ? 'e.g. Tech Room Trip 2026' : undefined}
          required
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-event`}>Event</Label>
        <Input
          id={`${idPrefix}-event`}
          value={values.event}
          onChange={(e) => onChange({ event: e.target.value })}
          placeholder={hints ? 'e.g. Annual Photography Workshop' : undefined}
          required
          maxLength={200}
        />
      </div>
      <div className="space-y-2">
        <Label>Event Date</Label>
        <DatePicker
          value={values.eventDate}
          onChange={(eventDate) => onChange({ eventDate })}
        />
        {eventDateError && !values.eventDate && (
          <p role="alert" className="text-sm text-destructive">
            Event date is required
          </p>
        )}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-description`}>Description</Label>
        <Textarea
          id={`${idPrefix}-description`}
          value={values.description}
          onChange={(e) => onChange({ description: e.target.value })}
          placeholder={hints ? 'Optional' : undefined}
          rows={3}
          maxLength={1000}
        />
      </div>
    </>
  )
}
