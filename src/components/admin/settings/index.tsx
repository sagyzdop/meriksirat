import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { updateSettingsFn } from '@/lib/admin/functions/settings'
import { useState } from 'react'
import { toast } from 'sonner'
import { useRouter } from '@tanstack/react-router'
import { PageContainer } from '@/components/layout/page-container'
import { PageHeader } from '@/components/layout/page-header'
import { Section } from '@/components/layout/section'

interface SettingsData {
  id: string
  globalBookingNote: string | null
  operatingHoursStart: number | null
  operatingHoursEnd: number | null
  createdAt: Date | null
  updatedAt: Date | null
}

interface PageProps {
  settings: SettingsData
}

export function Page({ settings }: PageProps) {
  const router = useRouter()
  
  const [globalBookingNote, setGlobalBookingNote] = useState(settings?.globalBookingNote || '')
  const [startHour, setStartHour] = useState<number | ''>(Math.floor((settings?.operatingHoursStart || 0) / 60))
  const [startMinute, setStartMinute] = useState<number | ''>((settings?.operatingHoursStart || 0) % 60)
  const [endHour, setEndHour] = useState<number | ''>(Math.floor((settings?.operatingHoursEnd || 1439) / 60))
  const [endMinute, setEndMinute] = useState<number | ''>((settings?.operatingHoursEnd || 1439) % 60)
  const [isSaving, setIsSaving] = useState(false)
  
  const handleSave = async () => {
    const operatingHoursStart = (startHour === '' ? 0 : startHour) * 60 + (startMinute === '' ? 0 : startMinute)
    const operatingHoursEnd = (endHour === '' ? 0 : endHour) * 60 + (endMinute === '' ? 0 : endMinute)
    
    setIsSaving(true)
    try {
      await updateSettingsFn({
        data: {
          globalBookingNote,
          operatingHoursStart,
          operatingHoursEnd,
        },
      })
      toast.success('Settings updated successfully')
      router.invalidate()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update settings')
    } finally {
      setIsSaving(false)
    }
  }
  
  return (
    <PageContainer>
      <PageHeader 
        title="Settings"
        description="Manage system settings and configurations"
      />

      <div className="space-y-8">
        <Section
          title="Global Booking Note"
          description="This message will be appended to all Google Calendar event descriptions for bookings"
        >
          <div className="space-y-2">
            <Label htmlFor="globalNote">Booking Note</Label>
            <Textarea
              id="globalNote"
              placeholder="Enter a message that will be shown in all calendar events..."
              value={globalBookingNote}
              onChange={(e) => setGlobalBookingNote(e.target.value)}
              rows={4}
            />
          </div>
        </Section>

        <Section
          title="Operating Hours"
          description="Set the daily operating hours for equipment bookings"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Start Time</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={startHour}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setStartHour('')
                    } else {
                      setStartHour(Math.min(23, Math.max(0, parseInt(val))))
                    }
                  }}
                  placeholder="HH"
                  className="flex-1"
                />
                <span className="flex items-center">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={startMinute}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setStartMinute('')
                    } else {
                      setStartMinute(Math.min(59, Math.max(0, parseInt(val))))
                    }
                  }}
                  placeholder="MM"
                  className="flex-1"
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>End Time</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min="0"
                  max="23"
                  value={endHour}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setEndHour('')
                    } else {
                      setEndHour(Math.min(23, Math.max(0, parseInt(val))))
                    }
                  }}
                  placeholder="HH"
                  className="flex-1"
                />
                <span className="flex items-center">:</span>
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={endMinute}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '') {
                      setEndMinute('')
                    } else {
                      setEndMinute(Math.min(59, Math.max(0, parseInt(val))))
                    }
                  }}
                  placeholder="MM"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </Section>
      </div>

      <div className="flex justify-end pt-8">
        <Button 
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </PageContainer>
  )
}
