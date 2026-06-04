import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'

const BUCKET = 'receipts'
const MAX_SIZE_BYTES = 200 * 1024   // 200 KB hard limit server-side (client already compresses to 50 KB)

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_financials')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData = await req.formData()
  const file = formData.get('file') as File | null
  const enrollmentId = formData.get('enrollmentId') as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File too large (${Math.round(file.size / 1024)} KB). Compress to under 200 KB.` },
      { status: 400 }
    )
  }

  const db = createServiceClient()

  // Ensure bucket exists
  const { data: bucket } = await db.storage.getBucket(BUCKET)
  if (!bucket) {
    const { error: bucketErr } = await db.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_SIZE_BYTES,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
    if (bucketErr && !bucketErr.message.includes('already exists')) {
      return NextResponse.json({ error: `Storage error: ${bucketErr.message}` }, { status: 500 })
    }
  }

  // Build path: receipts/{year}/{month}/{enrollmentId or 'general'}/{timestamp}.jpg
  const now     = new Date()
  const year    = now.getFullYear()
  const month   = String(now.getMonth() + 1).padStart(2, '0')
  const folder  = enrollmentId ?? 'general'
  const stamp   = Date.now()
  const ext     = file.type === 'image/webp' ? 'webp' : file.type === 'image/png' ? 'png' : 'jpg'
  const path    = `${year}/${month}/${folder}/${stamp}.${ext}`

  const buffer  = await file.arrayBuffer()

  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(path, buffer, {
      contentType: file.type,
      upsert:      false,
    })

  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path)

  return NextResponse.json({ url: urlData.publicUrl, path })
}
