import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient }       from '@/lib/supabase/service'
import { getCurrentUser }            from '@/modules/rbac/guards'
import { logSystemEvent }            from '@/modules/observability'

const BUCKET         = 'receipts'
const MAX_SIZE_BYTES = 200 * 1024   // 200 KB server-side limit
const ALLOWED_MIMES  = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp'])

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.permissions.includes('manage_financials')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const formData     = await req.formData()
  const file         = formData.get('file')         as File | null
  const enrollmentId = formData.get('enrollmentId') as string | null
  const paymentId    = formData.get('paymentId')    as string | null

  if (!file) {
    return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
  }

  // Phase 9: Strict MIME validation (not just startsWith)
  if (!ALLOWED_MIMES.has(file.type)) {
    await logSystemEvent({
      type: 'STORAGE_VALIDATION_FAILED', severity: 'warning', module: 'finance-receipts',
      message: `Invalid MIME type: ${file.type}`, actor_user_id: user.id,
      payload: { mime: file.type, size_bytes: file.size, enrollment_id: enrollmentId },
    }).catch(() => {})
    return NextResponse.json({ error: 'File must be a JPEG, PNG, or WebP image' }, { status: 400 })
  }

  if (file.size > MAX_SIZE_BYTES) {
    await logSystemEvent({
      type: 'STORAGE_VALIDATION_FAILED', severity: 'warning', module: 'finance-receipts',
      message: `File too large: ${Math.round(file.size / 1024)} KB`,
      actor_user_id: user.id,
      payload: { size_kb: Math.round(file.size / 1024), max_kb: 200, enrollment_id: enrollmentId },
    }).catch(() => {})
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
    await logSystemEvent({
      type: 'STORAGE_VALIDATION_FAILED', severity: 'error', module: 'finance-receipts',
      message: `Upload failed: ${uploadErr.message}`,
      actor_user_id: user.id,
      payload: { path, enrollment_id: enrollmentId, error: uploadErr.message },
    }).catch(() => {})
    return NextResponse.json({ error: uploadErr.message }, { status: 500 })
  }

  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(path)
  const publicUrl = urlData.publicUrl

  // Phase 9: Store file metadata on the payment record if paymentId provided
  if (paymentId) {
    try {
      await db.from('finance_payments').update({
        receipt_url:          publicUrl,
        receipt_file_size_kb: Math.round(file.size / 1024),
        receipt_mime_type:    file.type,
        receipt_validated_at: new Date().toISOString(),
      }).eq('id', paymentId)
    } catch { /* non-fatal */ }
  }

  return NextResponse.json({ url: publicUrl, path, size_kb: Math.round(file.size / 1024) })
}
