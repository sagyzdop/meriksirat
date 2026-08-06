import { useParams } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getEquipmentByIdFn, type EquipmentWithCategory } from '@/lib/equipment'
import { GoogleCalendarView } from '@/components/shared/event-calendar/google-calendar-view'
import { EquipmentDetail } from './components/equipment-detail-page'
import { Spinner } from '@/components/ui/spinner'

export function Page() {
    const { _splat: equipmentId } = useParams({ strict: false })
    const [equipment, setEquipment] = useState<EquipmentWithCategory | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        async function loadEquipment() {
            if (!equipmentId) {
                setError('Equipment ID is required')
                setIsLoading(false)
                return
            }

            // Convert string ID to number
            const numericId = parseInt(equipmentId as string, 10)
            if (isNaN(numericId)) {
                setError('Invalid equipment ID')
                setIsLoading(false)
                return
            }

            try {
                setIsLoading(true)
                setError(null)
                const data = await getEquipmentByIdFn({ data: { equipmentId: numericId } })
                
                if (data) {
                    setEquipment(data)
                } else {
                    setError('Equipment not found or you don\'t have access to it')
                }
            } catch (err) {
                console.error('Failed to load equipment:', err)
                setError('Failed to load equipment details')
            } finally {
                setIsLoading(false)
            }
        }

        loadEquipment()
    }, [equipmentId])


    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Spinner className="h-8 w-8" />
            </div>
        )
    }

    if (error || !equipment) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center px-4">
                    <h2 className="text-xl sm:text-2xl font-semibold text-gray-900">Equipment not found</h2>
                    <p className="text-gray-600 mt-2 text-sm sm:text-base">{error || 'The equipment you\'re looking for doesn\'t exist or you don\'t have access to it.'}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="w-full space-y-8">
            <EquipmentDetail equipment={equipment} />

            {/* Calendar View */}
            <div className="max-w-7xl mx-auto px-4">
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Availability</h3>
                    <GoogleCalendarView calendarId={equipment.googleCalendarId} />
                </div>
            </div>
        </div>
    );
}