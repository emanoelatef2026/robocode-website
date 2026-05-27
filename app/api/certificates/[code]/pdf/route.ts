import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import QRCode from 'qrcode'
import { getCertificateDetail, getCertificateByCode } from '@/modules/certificates/queries'
import { CertificatePDF } from '@/modules/certificates/pdf-template'
import React, { type ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  const cert = await getCertificateByCode(code)
  if (!cert) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }

  const detail = await getCertificateDetail(cert.id)
  if (!detail) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }

  // Generate QR code pointing to public verification page
  const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://robocode.academy'}/verify/${code}`
  const qrDataUrl = await QRCode.toDataURL(verifyUrl, {
    width: 112,
    margin: 1,
    color: { dark: '#0B1F3A', light: '#FFFFFF' },
  })

  const element = React.createElement(CertificatePDF, { certificate: detail, qrDataUrl })
  const buffer  = await renderToBuffer(element as ReactElement<DocumentProps>)

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="certificate-${code}.pdf"`,
      'Cache-Control':       'private, max-age=3600',
    },
  })
}
