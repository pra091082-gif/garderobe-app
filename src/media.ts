import { useEffect, useState } from 'react'

/** Decodes an image; falls back to an <img> element where createImageBitmap cannot read the file (older iOS). */
async function decode(
  file: Blob,
): Promise<{ source: CanvasImageSource; width: number; height: number; close(): void }> {
  try {
    const bitmap = await createImageBitmap(file)
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() }
  } catch {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.src = url
    try {
      await img.decode()
    } catch {
      URL.revokeObjectURL(url)
      throw new Error('Foto kon niet worden gelezen')
    }
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => URL.revokeObjectURL(url) }
  }
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Scales a photo down so it stays small in IndexedDB (longest side `max` px).
 * With `crop` (in pixels of the original) only that part is kept.
 */
export async function resizeImage(file: Blob, max = 900, crop?: Box): Promise<Blob> {
  const img = await decode(file)
  const area = crop ?? { x: 0, y: 0, width: img.width, height: img.height }
  const scale = Math.min(1, max / Math.max(area.width, area.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(area.width * scale))
  canvas.height = Math.max(1, Math.round(area.height * scale))
  const ctx = canvas.getContext('2d')!
  // White behind transparent PNGs, otherwise they turn black as JPEG.
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(img.source, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height)
  img.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto verwerken mislukt'))), 'image/jpeg', 0.82),
  )
}

/** Width and height of an image in pixels. */
export async function imageSize(file: Blob): Promise<{ width: number; height: number }> {
  const img = await decode(file)
  img.close()
  return { width: img.width, height: img.height }
}

export function useObjectUrl(blob?: Blob): string | undefined {
  const [entry, setEntry] = useState<{ blob: Blob; url: string }>()
  useEffect(() => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    // The object URL is an external resource that must be revoked, so it is created in an effect.
    // eslint-disable-next-line react/set-state-in-effect
    setEntry({ blob, url })
    return () => URL.revokeObjectURL(url)
  }, [blob])
  return entry && entry.blob === blob ? entry.url : undefined
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob()
}

/** Downloads and shrinks a shop image; undefined when the shop does not allow cross-origin downloads. */
export async function downloadImage(url: string): Promise<Blob | undefined> {
  try {
    const res = await fetch(url, { mode: 'cors', referrerPolicy: 'no-referrer' })
    if (!res.ok) return undefined
    return await resizeImage(await res.blob())
  } catch {
    return undefined
  }
}
