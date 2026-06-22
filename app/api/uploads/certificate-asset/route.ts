import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const BUCKET    = 'certificate-assets'
const MAX_BYTES = 2 * 1024 * 1024   // 2 MB

export async function POST(req: NextRequest) {
  // Require authenticated session (admin pages are also guarded by middleware)
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
    return NextResponse.json(
      { error: 'Only JPEG, PNG, or WebP images are allowed.' },
      { status: 400 }
    )
  }

  const buffer = await file.arrayBuffer()
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json(
      { error: 'Image exceeds 2 MB. Please use a smaller file.' },
      { status: 400 }
    )
  }

  const db  = createServiceClient()
  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  // Prefix by user id to avoid collisions and help with auditing
  const path = `${user.id}/${Date.now()}.${ext}`

  const { data: uploadData, error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, Buffer.from(buffer), {
      contentType:  file.type,
      cacheControl: '31536000',   // 1 year — assets rarely change
      upsert:       false,
    })

  if (uploadErr || !uploadData) {
    console.error('[certificate-asset] storage error', uploadErr?.message)
    return NextResponse.json(
      { error: uploadErr?.message ?? 'Upload failed. Please try again.' },
      { status: 500 }
    )
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(uploadData.path)
  return NextResponse.json({ url: urlData?.publicUrl })
}
