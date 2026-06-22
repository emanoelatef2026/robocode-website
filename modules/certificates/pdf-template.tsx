import React from 'react'
import {
  Document, Page, Text, View, Image, Font,
  Svg, G, Polygon, Circle, Line, Rect, Defs, LinearGradient, Stop,
  StyleSheet,
} from '@react-pdf/renderer'
import type { CertificateDetail } from './types'

// ─── Fonts ────────────────────────────────────────────────────────────────────
Font.register({
  family: 'Cinzel',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cinzel@5/files/cinzel-latin-400-normal.woff2', fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cinzel@5/files/cinzel-latin-600-normal.woff2', fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/cinzel@5/files/cinzel-latin-700-normal.woff2', fontWeight: 700 },
  ],
})

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5/files/montserrat-latin-400-normal.woff2',  fontWeight: 400 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5/files/montserrat-latin-400-italic.woff2',  fontWeight: 400, fontStyle: 'italic' },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5/files/montserrat-latin-600-normal.woff2',  fontWeight: 600 },
    { src: 'https://cdn.jsdelivr.net/npm/@fontsource/montserrat@5/files/montserrat-latin-700-normal.woff2',  fontWeight: 700 },
  ],
})

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY        = '#1a2754'
const CYAN        = '#29b5e6'
const ORANGE      = '#f5a623'
const GOLD        = '#c9a84c'
const MID_GRAY    = '#888888'
const LIGHT_GRAY  = '#aaaaaa'
const PALE_GRAY   = '#c0c0c0'

// ─── Styles ───────────────────────────────────────────────────────────────────
// All measurements are design px × 0.75 (96dpi → 72dpi/pt conversion).
const s = StyleSheet.create({
  page: {
    backgroundColor: '#ffffff',
    position: 'relative',
  },

  borderNavy: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderWidth: 11,
    borderStyle: 'solid',
    borderColor: NAVY,
  },
  borderGold: {
    position: 'absolute',
    top: 16, left: 16, right: 16, bottom: 16,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: GOLD,
  },
  borderGoldFade: {
    position: 'absolute',
    top: 20, left: 20, right: 20, bottom: 20,
    borderWidth: 2.5,
    borderStyle: 'solid',
    borderColor: 'rgba(201,168,76,0.4)',
  },

  content: {
    position: 'absolute',
    top: 24, left: 24, right: 24, bottom: 24,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },

  // Header
  header: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  circuitWrapper: {
    flex: 1,
    height: 36,
    overflow: 'hidden',
  },
  logo: {
    height: 69,
    objectFit: 'contain',
  },
  certTitle: {
    fontFamily: 'Cinzel',
    fontSize: 20,
    fontWeight: 700,
    color: NAVY,
    letterSpacing: 5,
    textAlign: 'center',
    marginBottom: 5,
  },

  // Body
  body: {
    flexDirection: 'column',
    alignItems: 'center',
  },
  certifyText: {
    fontFamily: 'Montserrat',
    fontSize: 10,
    fontStyle: 'italic',
    color: '#a0a0a0',
    letterSpacing: 1.5,
    marginBottom: 7,
  },
  studentName: {
    fontFamily: 'Cinzel',
    fontSize: 30,
    fontWeight: 600,
    color: NAVY,
    textAlign: 'center',
    lineHeight: 1.2,
    marginBottom: 4,
  },
  completedText: {
    fontFamily: 'Montserrat',
    fontSize: 10,
    color: MID_GRAY,
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  courseName: {
    fontFamily: 'Montserrat',
    fontSize: 15,
    fontWeight: 600,
    color: CYAN,
    textAlign: 'center',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaLabel: {
    fontFamily: 'Montserrat',
    fontSize: 9,
    color: LIGHT_GRAY,
  },
  metaValue: {
    fontFamily: 'Montserrat',
    fontSize: 9,
    fontWeight: 600,
    color: NAVY,
  },

  // Footer
  footer: {
    flexDirection: 'column',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },

  // QR block
  qrBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  qrBox: {
    width: 62,
    height: 62,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  qrImage: {
    width: 57,
    height: 57,
  },
  certIdLabel: {
    fontFamily: 'Montserrat',
    fontSize: 6,
    color: PALE_GRAY,
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  certIdCode: {
    fontFamily: 'Montserrat',
    fontSize: 10,
    fontWeight: 700,
    color: NAVY,
    letterSpacing: 1.1,
    marginBottom: 4,
  },
  certIdScan: {
    fontFamily: 'Montserrat',
    fontSize: 6.5,
    color: PALE_GRAY,
    fontStyle: 'italic',
  },

  // STEM block
  stemBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stemLogo: {
    height: 58,
    objectFit: 'contain',
  },

  // Signature block
  sigBlock: {
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 142,
  },
  sigImageStyle: {
    width: 110,
    height: 33,
    objectFit: 'contain',
  },
  sigName: {
    fontFamily: 'Montserrat',
    fontSize: 9,
    fontWeight: 600,
    color: NAVY,
    letterSpacing: 0.4,
    textAlign: 'center',
    marginTop: 6,
  },
  sigTitle: {
    fontFamily: 'Montserrat',
    fontSize: 7.5,
    color: LIGHT_GRAY,
    marginTop: 2,
    textAlign: 'center',
  },
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

// ─── SVG subcomponents ────────────────────────────────────────────────────────

function CornerBase({ primaryDot, secondaryDot }: { primaryDot: string; secondaryDot: string }) {
  return (
    <G>
      <Polygon points="40,15 66,15 79,37 66,58 40,58 27,37" fill="none" stroke={NAVY} strokeWidth="1.5" opacity="0.2" />
      <Polygon points="16,58 28,58 34,68 28,79 16,79 10,68" fill="none" stroke={NAVY} strokeWidth="1" opacity="0.15" />
      <Circle cx="27" cy="37" r="3.5" fill={primaryDot} opacity="0.55" />
      <Circle cx="79" cy="15" r="2.5" fill={secondaryDot} opacity="0.8" />
      <Circle cx="66" cy="58" r="2" fill={NAVY} opacity="0.2" />
      <Line x1="27" y1="37" x2="0" y2="37" stroke={NAVY} strokeWidth="1" opacity="0.2" />
      <Line x1="40" y1="15" x2="40" y2="0" stroke={NAVY} strokeWidth="1" opacity="0.2" />
      <Line x1="10" y1="68" x2="0" y2="68" stroke={NAVY} strokeWidth="0.8" opacity="0.15" />
    </G>
  )
}

function CornerTL() {
  return (
    <View style={{ position: 'absolute', top: 0, left: 0 }}>
      <Svg width={90} height={90} viewBox="0 0 120 120">
        <CornerBase primaryDot={CYAN} secondaryDot={ORANGE} />
      </Svg>
    </View>
  )
}

function CornerTR() {
  return (
    <View style={{ position: 'absolute', top: 0, right: 0 }}>
      <Svg width={90} height={90} viewBox="0 0 120 120">
        <G transform="translate(120,0) scale(-1,1)">
          <CornerBase primaryDot={CYAN} secondaryDot={ORANGE} />
        </G>
      </Svg>
    </View>
  )
}

function CornerBL() {
  return (
    <View style={{ position: 'absolute', bottom: 0, left: 0 }}>
      <Svg width={90} height={90} viewBox="0 0 120 120">
        <G transform="translate(0,120) scale(1,-1)">
          <CornerBase primaryDot={ORANGE} secondaryDot={CYAN} />
        </G>
      </Svg>
    </View>
  )
}

function CornerBR() {
  return (
    <View style={{ position: 'absolute', bottom: 0, right: 0 }}>
      <Svg width={90} height={90} viewBox="0 0 120 120">
        <G transform="translate(120,120) scale(-1,-1)">
          <CornerBase primaryDot={ORANGE} secondaryDot={CYAN} />
        </G>
      </Svg>
    </View>
  )
}

function CyanAccentLine() {
  return (
    <Svg width={195} height={3} viewBox="0 0 195 3">
      <Defs>
        <LinearGradient id="cyanAcc" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"   stopColor={CYAN} stopOpacity="0" />
          <Stop offset="0.3" stopColor={CYAN} stopOpacity="1" />
          <Stop offset="0.7" stopColor={CYAN} stopOpacity="1" />
          <Stop offset="1"   stopColor={CYAN} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0.5" width="195" height="2" fill="url(#cyanAcc)" />
    </Svg>
  )
}

function GoldOrnamentBar({ width }: { width: number }) {
  const half = (width - 16) / 2
  const sc   = half  // star center x offset from left

  return (
    <Svg width={width} height={14} viewBox={`0 0 ${width} 14`}>
      <Defs>
        <LinearGradient id="goldL" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GOLD} stopOpacity="0" />
          <Stop offset="1" stopColor={GOLD} stopOpacity="1" />
        </LinearGradient>
        <LinearGradient id="goldR" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={GOLD} stopOpacity="1" />
          <Stop offset="1" stopColor={GOLD} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="6.25" width={half} height="1.5" fill="url(#goldL)" />
      <Polygon
        points={`${sc + 8},0 ${sc + 9.5},5.5 ${sc + 15},7 ${sc + 9.5},8.5 ${sc + 8},14 ${sc + 6.5},8.5 ${sc + 1},7 ${sc + 6.5},5.5`}
        fill={GOLD}
        opacity="0.8"
      />
      <Rect x={sc + 16} y="6.25" width={half} height="1.5" fill="url(#goldR)" />
    </Svg>
  )
}

function GoldUnderline({ width }: { width: number }) {
  return (
    <Svg width={width} height={2} viewBox={`0 0 ${width} 2`}>
      <Defs>
        <LinearGradient id="nameUL" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"   stopColor={GOLD} stopOpacity="0" />
          <Stop offset="0.4" stopColor={GOLD} stopOpacity="1" />
          <Stop offset="0.6" stopColor={GOLD} stopOpacity="1" />
          <Stop offset="1"   stopColor={GOLD} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0.5" width={width} height="1" fill="url(#nameUL)" />
    </Svg>
  )
}

function GoldDivider({ width }: { width: number }) {
  return (
    <Svg width={width} height={2} viewBox={`0 0 ${width} 2`}>
      <Defs>
        <LinearGradient id="footDiv" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"    stopColor={GOLD} stopOpacity="0" />
          <Stop offset="0.25" stopColor={GOLD} stopOpacity="1" />
          <Stop offset="0.75" stopColor={GOLD} stopOpacity="1" />
          <Stop offset="1"    stopColor={GOLD} stopOpacity="0" />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0.5" width={width} height="1" fill="url(#footDiv)" />
    </Svg>
  )
}

function GoldStar() {
  return (
    <Svg width={7} height={7} viewBox="0 0 8 8">
      <Polygon
        points="4,0 5,3 8,4 5,5 4,8 3,5 0,4 3,3"
        fill={GOLD}
        opacity="0.9"
      />
    </Svg>
  )
}

function CircuitDecoration({ flip = false }: { flip?: boolean }) {
  const transform = flip ? 'translate(360,0) scale(-1,1)' : undefined
  return (
    <Svg width={340} height={36} viewBox="0 0 360 48">
      <G transform={transform}>
        <Line x1="0"   y1="24" x2="320" y2="24" stroke={NAVY} strokeWidth="1.2" opacity="0.22" />
        <Line x1="220" y1="8"  x2="220" y2="40" stroke={NAVY} strokeWidth="1"   opacity="0.18" />
        <Circle cx="220" cy="24" r="4.5" fill={CYAN}  opacity="0.55" />
        <Circle cx="120" cy="24" r="3"   fill={ORANGE} opacity="0.75" />
        <Circle cx="320" cy="24" r="2.5" fill={NAVY}  opacity="0.25" />
        <Rect x="116" y="8" width="8" height="8" fill="none" stroke={NAVY} strokeWidth="1" opacity="0.2" />
        <Line x1="120" y1="16" x2="120" y2="24" stroke={NAVY} strokeWidth="1"   opacity="0.18" />
        <Line x1="60"  y1="24" x2="60"  y2="10" stroke={NAVY} strokeWidth="0.8" opacity="0.15" />
        <Circle cx="60" cy="10" r="2" fill={NAVY} opacity="0.2" />
      </G>
    </Svg>
  )
}

function SigLine() {
  return (
    <Svg width={142} height={40} viewBox="0 0 142 40">
      <Line x1="0" y1="39" x2="142" y2="39" stroke={NAVY} strokeWidth="1" />
    </Svg>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
interface Props {
  certificate: CertificateDetail
  qrDataUrl:   string
}

export function CertificatePDF({ certificate, qrDataUrl }: Props) {
  const template       = certificate.template
  const logoUrl        = template?.logo_url        ?? null
  const stemLogoUrl    = template?.stem_logo_url   ?? null
  const signatureUrl   = template?.signature_url   ?? null
  const signatoryName  = template?.signatory_name  ?? 'Emanoel Atef'
  const signatoryTitle = template?.signatory_title ?? 'CEO, Robocode School'

  const certId      = certificate.certificate_code
  const studentName = certificate.recipient_name
  const courseName  = certificate.course_title ?? certificate.title
  const dateStr     = formatDate(certificate.issued_at)
  // course_hours is not yet joined — read if present, hide otherwise
  const hours       = (certificate as any).course_hours as number | null | undefined

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={s.page}>

        {/* ── Border layers ── */}
        <View style={s.borderNavy} />
        <View style={s.borderGold} />
        <View style={s.borderGoldFade} />

        {/* ── Corner SVGs ── */}
        <CornerTL />
        <CornerTR />
        <CornerBL />
        <CornerBR />

        {/* ── Main content ── */}
        <View style={s.content}>

          {/* HEADER */}
          <View style={s.header}>
            <View style={s.logoRow}>
              <View style={s.circuitWrapper}>
                <CircuitDecoration />
              </View>
              <View style={{ flexShrink: 0 }}>
                {logoUrl
                  ? <Image src={logoUrl} style={s.logo} />
                  : <View style={{ width: 90, height: 69 }} />
                }
              </View>
              <View style={[s.circuitWrapper, { alignItems: 'flex-end' }]}>
                <CircuitDecoration flip />
              </View>
            </View>

            <View style={{ marginTop: 1, marginBottom: 7 }}>
              <CyanAccentLine />
            </View>

            <Text style={s.certTitle}>CERTIFICATE OF COMPLETION</Text>

            <GoldOrnamentBar width={420} />
          </View>

          {/* BODY */}
          <View style={s.body}>
            <Text style={s.certifyText}>This is to certify that</Text>

            <Text style={s.studentName}>{studentName}</Text>

            <View style={{ marginBottom: 9 }}>
              <GoldUnderline width={345} />
            </View>

            <Text style={s.completedText}>has successfully completed the program</Text>

            <Text style={s.courseName}>{courseName}</Text>

            <View style={s.metaRow}>
              {hours != null && (
                <>
                  <View style={s.metaItem}>
                    <Text style={s.metaLabel}>Duration: </Text>
                    <Text style={s.metaValue}>{hours} Hours</Text>
                  </View>
                  <GoldStar />
                </>
              )}
              <View style={s.metaItem}>
                <Text style={s.metaLabel}>Completion Date: </Text>
                <Text style={s.metaValue}>{dateStr}</Text>
              </View>
            </View>
          </View>

          {/* FOOTER */}
          <View style={s.footer}>
            <View style={{ marginBottom: 10 }}>
              <GoldDivider width={793} />
            </View>

            <View style={s.footerRow}>

              {/* Left: QR + cert ID */}
              <View style={s.qrBlock}>
                <View style={s.qrBox}>
                  <Image src={qrDataUrl} style={s.qrImage} />
                </View>
                <View>
                  <Text style={s.certIdLabel}>CERTIFICATE ID</Text>
                  <Text style={s.certIdCode}>{certId}</Text>
                  <Text style={s.certIdScan}>Scan to verify authenticity</Text>
                </View>
              </View>

              {/* Center: STEM logo */}
              <View style={s.stemBlock}>
                {stemLogoUrl
                  ? <Image src={stemLogoUrl} style={s.stemLogo} />
                  : <View style={{ width: 58, height: 58, backgroundColor: '#E2E8F0', borderRadius: 3 }} />
                }
              </View>

              {/* Right: Signature */}
              <View style={s.sigBlock}>
                {signatureUrl
                  ? <Image src={signatureUrl} style={s.sigImageStyle} />
                  : <SigLine />
                }
                <Text style={s.sigName}>{signatoryName}</Text>
                <Text style={s.sigTitle}>{signatoryTitle}</Text>
              </View>

            </View>
          </View>

        </View>
      </Page>
    </Document>
  )
}
