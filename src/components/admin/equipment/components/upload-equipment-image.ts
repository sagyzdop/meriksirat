import { uploadEquipmentImageFn } from '@/lib/equipment'
import { shrinkImage } from '@/lib/equipment/shrink-image'

export async function uploadEquipmentImage(equipmentId: number, file: File) {
  const form = new FormData()
  form.set('equipmentId', String(equipmentId))
  form.set('file', await shrinkImage(file))
  return uploadEquipmentImageFn({ data: form })
}
