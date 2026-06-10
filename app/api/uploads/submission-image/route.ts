import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const BUCKET    = 'submissions'
const MAX_BYTES = 512 * 1024   // 500 KB — client compresses to ~100 KB first

export async function POST(req: NextRequest) {
  const authClient = await createServerClient()
  const { data: { user }, error: authErr } = await authClient.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ error: 'Only JPEG, PNG, or WebP images are allowed.' }, { status: 400 })
  }

  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Image exceeds 500 KB. Please compress before uploading.' },
      { status: 400 }
    )
  }

  const db  = createServiceClient()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const path = `${user.id}/${Date.now()}.${ext}`

  const { data: uploadData, error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(buffer), {
      contentType:  file.type,
      cacheControl: '3600',
      upsert:       false,
    })

  if (uploadErr || !uploadData) {
    console.error('[submission-image] storage error', uploadErr?.message)
    return NextResponse.json(
      { error: uploadErr?.message ?? 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(uploadData.path)

  return NextResponse.json({ url: urlData?.publicUrl ?? null, path: uploadData.path })
}
