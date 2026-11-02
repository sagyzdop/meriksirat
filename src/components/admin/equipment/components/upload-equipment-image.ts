import { uploadEquipmentImageFn } from '@/lib/equipment'

export async function uploadEquipmentImage(equipmentId: number, file: File) {
  const reader = new FileReader()
  const imageData = await new Promise<string>((resolve, reject) => {
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return uploadEquipmentImageFn({
    data: {
      equipmentId,
      imageData,
      contentType: file.type,
      fileName: file.name,
    },
  })
}
