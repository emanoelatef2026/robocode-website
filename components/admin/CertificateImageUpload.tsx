'use client'

import { useState, useRef } from 'react'
import { compressImage } from '@/lib/uploads/compressImage'

interface Props {
  label:         string
  name:          string
  defaultValue?: string | null
  hint?:         string
}

export default function CertificateImageUpload({ label, name, defaultValue, hint }: Props) {
  const [url, setUrl]           = useState<string>(defaultValue ?? '')
  const [imgOk, setImgOk]       = useState<boolean>(true)   // false when img fails to load
  const [uploading, setUploading] = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const inputRef                = useRef<HTMLInputElement>(null)

  const hasImage = Boolean(url) && imgOk

  async function handleFile(file: File) {
    setError(null)
    setUploading(true)
    try {
      const { blob } = await compressImage(file, { maxKB: 800, maxWidth: 1600 })
      const compressed = new File([blob], file.name, { type: blob.type })

      const fd = new FormData()
      fd.append('file', compressed)

      const res  = await fetch('/api/uploads/certificate-asset', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Upload failed')

      setUrl(json.url)
      setImgOk(true)
    } catch (err: any) {
      setError(err.message ?? 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  function handleClear() {
    setUrl('')
    setImgOk(true)
    setError(null)
  }

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-[#0B1F3A]">{label}</label>

      {/* Hidden input carries the URL for form submission */}
      <input type="hidden" name={name} value={url} />

      <div className="flex items-start gap-4">
        {/* Thumbnail or placeholder */}
        <div className="relative flex-shrink-0">
          {hasImage ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt={label}
                onError={() => setImgOk(false)}
                className="h-20 w-auto max-w-[160px] rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] object-contain p-1"
              />
              <button
                type="button"
                onClick={handleClear}
                aria-label="Remove image"
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs leading-none hover:bg-red-600 transition"
              >
                ×
              </button>
            </>
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-lg border border-dashed border-[#E2E8F0] bg-[#F8FAFC]">
              <svg className="h-7 w-7 text-[#CBD5E1]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3 21h18M3.75 3h16.5M12 8.25h.008v.008H12V8.25z" />
              </svg>
            </div>
          )}
        </div>

        {/* Upload button */}
        <div className="flex flex-1 flex-col justify-center gap-1.5 pt-1">
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex w-fit items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0B1F3A] transition hover:border-[#FF8A1F] hover:text-[#FF8A1F] disabled:opacity-50"
          >
            {uploading ? (
              <>
                <svg className="h-4 w-4 animate-spin text-[#FF8A1F]" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading…
              </>
            ) : (
              <>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
                {hasImage ? 'Replace image' : 'Upload image'}
              </>
            )}
          </button>

          {hint && <p className="text-xs text-[#94A3B8]">{hint}</p>}

          {/* Show a soft warning if we have a URL but it failed to load */}
          {Boolean(url) && !imgOk && !uploading && (
            <p className="text-xs text-amber-500">
              Previous URL couldn&apos;t load — upload a new image to replace it.
            </p>
          )}

          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
          e.target.value = ''
        }}
      />
    </div>
  )
}
