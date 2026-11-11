export const EQUIPMENT_IMAGE_MAX_SIDE = 1280
const QUALITY = 0.82

/** The size an image of `width` x `height` is scaled to, never upscaled. */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = EQUIPMENT_IMAGE_MAX_SIDE
): { width: number; height: number } {
  const scale = Math.min(1, maxSide / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function encode(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY))
}

/**
 * Scales an equipment photo down in the browser and re-encodes it as WebP
 * (JPEG where the browser cannot write WebP), so the Worker stores a small
 * file. Keeps the original when it is already smaller.
 */
export async function shrinkImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d')
  if (!context) {
    bitmap.close()
    return file
  }
  context.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const webp = await encode(canvas, 'image/webp')
  const blob =
    webp?.type === 'image/webp' ? webp : await encode(canvas, 'image/jpeg')
  return blob && blob.size < file.size ? blob : file
}
