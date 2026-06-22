// Shared browser-side image compression utility.
// Compresses an image File to <= maxKB using Canvas API.
// Maintains aspect ratio; max width capped; JPEG quality stepped until target met.
// PNG inputs are kept as PNG so alpha transparency is preserved.
// Safe on any image/* MIME type.

export interface CompressOptions {
  maxKB?:    number  // default 100
  maxWidth?: number  // default 1200
}

export interface CompressResult {
  blob:   Blob
  sizeKB: number
}

export async function compressImage(
  file: File,
  { maxKB = 100, maxWidth = 1200 }: CompressOptions = {}
): Promise<CompressResult> {
  const maxBytes = maxKB * 1024
  const isPng    = file.type === 'image/png'

  // Small JPEG that fits: return as-is (PNG always goes through to apply maxWidth and keep PNG format)
  if (file.size <= maxBytes && file.type === 'image/jpeg') {
    return { blob: file, sizeKB: Math.round(file.size / 1024) }
  }

  const blob = await _compress(file, maxWidth, maxBytes, isPng)
  return { blob, sizeKB: Math.round(blob.size / 1024) }
}

function _compress(
  file: File,
  maxWidth: number,
  maxBytes: number,
  preserveAlpha: boolean,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img       = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(1, maxWidth / img.naturalWidth)
      const w     = Math.max(1, Math.floor(img.naturalWidth  * scale))
      const h     = Math.max(1, Math.floor(img.naturalHeight * scale))

      const canvas = document.createElement('canvas')
      canvas.width  = w
      canvas.height = h

      const ctx = canvas.getContext('2d')
      if (!ctx) { reject(new Error('Canvas 2D not available')); return }

      // Canvas is transparent by default; drawing a PNG preserves its alpha channel.
      // Do NOT fillRect here — that would destroy transparency.
      ctx.drawImage(img, 0, 0, w, h)

      if (preserveAlpha) {
        // Output as PNG so the alpha channel survives intact.
        // PNG is lossless — quality param is irrelevant; one pass suffices.
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('toBlob returned null')); return }
            resolve(blob)
          },
          'image/png',
        )
        return
      }

      // JPEG path: step quality down until the file fits.
      let quality = 0.9

      const attempt = () => {
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('toBlob returned null')); return }
            if (blob.size <= maxBytes || quality <= 0.1) {
              resolve(blob)
            } else {
              quality = Math.max(0.1, quality - 0.1)
              attempt()
            }
          },
          'image/jpeg',
          quality,
        )
      }

      attempt()
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error('Failed to load image for compression'))
    }

    img.src = objectUrl
  })
}

export async function compressToFile(
  file: File,
  options?: CompressOptions
): Promise<File> {
  const { blob } = await compressImage(file, options)
  const isPng    = blob.type === 'image/png'
  const ext      = isPng ? 'png' : 'jpg'
  const name     = file.name.replace(/\.[^.]+$/, '') + `_compressed.${ext}`
  return new File([blob], name, { type: blob.type, lastModified: Date.now() })
}
