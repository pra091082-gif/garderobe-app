import { useEffect, useState } from 'react'

/** Scales a photo down so it stays small in IndexedDB (longest side `max` px). */
export async function resizeImage(file: Blob, max = 900): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Foto verwerken mislukt'))), 'image/jpeg', 0.82),
  )
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
