import React from 'react'
import {
  Document, Page, Text, View, Image, Font,
  Svg, G, Polygon, Circle, Line, Rect, Defs, LinearGradient, Stop,
  StyleSheet,
} from '@react-pdf/renderer'
import type { CertificateDetail } from './types'

// ─── Fonts (Google Fonts gstatic TTF — compatible with react-pdf/fontkit) ────
Font.register({
  family: 'Cinzel',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-tbnTYo.ttf', fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-gjgTYo.ttf', fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/cinzel/v26/8vIU7ww63mVu7gtR-kwKxNvkNOjw-jHgTYo.ttf', fontWeight: 700 },
  ],
})

Font.register({
  family: 'Montserrat',
  fonts: [
    { src: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Ew-.ttf',       fontWeight: 400 },
    { src: 'https://fonts.gstatic.com/s/montserrat/v31/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R9aX8.ttf',   fontWeight: 400, fontStyle: 'italic' },
    { src: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCu170w-.ttf',       fontWeight: 600 },
    { src: 'https://fonts.gstatic.com/s/montserrat/v31/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM70w-.ttf',       fontWeight: 700 },
  ],
})

// ─── Design tokens ────────────────────────────────────────────────────────────
const NAVY       = '#1a2754'
const CYAN       = '#29b5e6'
const ORANGE     = '#f5a623'
const GOLD       = '#c9a84c'
const MID_GRAY   = '#888888'
const LIGHT_GRAY = '#aaaaaa'
const PALE_GRAY  = '#c0c0c0'

// ─── Styles ───────────────────────────────────────────────────────────────────
// All measurements: design px × 0.75 (96dpi → 72dpi/pt conversion).
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

  // ── Header ──────────────────────────────────────────────────────────────────
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
  // 10–15% larger logos
  logo: {
    height: 78,
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
  // Course name — visually prominent: large, bold, centred above the body
  courseNameLarge: {
    fontFamily: 'Cinzel',
    fontSize: 24,
    fontWeight: 700,
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 4,
    lineHeight: 1.25,
    marginTop: 8,
    marginBottom: 2,
  },

  // ── Body ────────────────────────────────────────────────────────────────────
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
    fontSize: 34,
    fontWeight: 600,
    color: NAVY,
    textAlign: 'center',
    lineHeight: 1.2,
    marginBottom: 5,
  },

  // ── Projects section ─────────────────────────────────────────────────────────
  //
  // Centering strategy:
  //   • projectsSection fills body width (width: '100%') and sets alignItems: 'center'
  //   • child containers (oneCol / twoCol) have FIXED pt widths so yoga can
  //     compute their actual size and center them within the section
  //   • percentage widths were removed — they created wide empty boxes that
  //     made left-aligned text look off-center
  //
  projectsSection: {
    width: '100%',
    marginTop: 14,
    alignItems: 'center',
  },
  projectsHeading: {
    fontFamily: 'Cinzel',
    fontSize: 13,
    fontWeight: 600,
    color: GOLD,
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 6,
  },
  projectsDivider: {
    marginBottom: 8,
  },
  // Single-column container (≤4 projects).
  // 270pt ≈ 360px — wide enough for ~30-char names on one line.
  // Parent alignItems: 'center' centres this block horizontally.
  projectsOneCol: {
    flexDirection: 'column',
    width: 270,
  },
  // Two-column outer row (≥5 projects).
  // No explicit width — yoga derives it from the two 200pt columns + 44pt gap
  // = 444pt total, which is then centred by the parent alignItems: 'center'.
  projectsTwoCol: {
    flexDirection: 'row',
    gap: 44,
  },
  // Each column: fixed 200pt so text wraps at a consistent edge.
  // flex: 1 on the title text fills (200 − bullet − 5pt gap) ≈ 185pt.
  projectsColLeft: {
    flexDirection: 'column',
    width: 200,
  },
  projectsColRight: {
    flexDirection: 'column',
    width: 200,
  },
  projectItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 5,
    marginBottom: 6,
  },
  projectBullet: {
    fontFamily: 'Montserrat',
    fontSize: 11,
    fontWeight: 600,
    color: CYAN,
    lineHeight: 1.35,
    flexShrink: 0,
  },
  // flex: 1 distributes remaining row width to the title text.
  // Works correctly because the parent column now has a fixed width.
  projectTitle: {
    fontFamily: 'Montserrat',
    fontSize: 11,
    color: NAVY,
    lineHeight: 1.35,
    flex: 1,
  },
  projectsExtra: {
    fontFamily: 'Montserrat',
    fontSize: 9,
    fontStyle: 'italic',
    color: MID_GRAY,
    marginTop: 5,
    textAlign: 'center',
  },

  // ── Meta row (date, hours) ──────────────────────────────────────────────────
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 10,
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

  // ── Footer ──────────────────────────────────────────────────────────────────
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

  // Stamp overlay — absolutely positioned in certificate body, unchanged
  stampOverlay: {
    position: 'absolute',
    bottom: 120,
    right: 58,
  },
  stampOverlayImg: {
    width: 140,
    height: 140,
    objectFit: 'contain',
  },

  // STEM block (footer centre)
  stemBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stemLogo: {
    height: 66,
    objectFit: 'contain',
  },

  // Signature block
  sigBlock: {
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: 165,
  },
  sigImageStyle: {
    width: 155,
    height: 52,
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
  const sc   = half

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
    <Svg width={155} height={40} viewBox="0 0 155 40">
      <Line x1="0" y1="39" x2="155" y2="39" stroke={NAVY} strokeWidth="1" />
    </Svg>
  )
}

// ─── Projects section component ───────────────────────────────────────────────

interface ProjectItem { title: string; sort_order: number }

function ProjectsSection({ projects }: { projects: ProjectItem[] }) {
  const sorted  = [...projects].sort((a, b) => a.sort_order - b.sort_order)
  const display = sorted.slice(0, 10)
  const extra   = sorted.length > 10 ? sorted.length - 10 : 0

  const isTwoCol = display.length >= 5

  // Left-column-first split for two-column layout
  const half  = Math.ceil(display.length / 2)
  const left  = display.slice(0, half)
  const right = display.slice(half)

  return (
    <View style={s.projectsSection}>
      <Text style={s.projectsHeading}>PROJECTS COMPLETED</Text>

      <View style={s.projectsDivider}>
        <GoldUnderline width={220} />
      </View>

      {isTwoCol ? (
        <View style={s.projectsTwoCol}>
          <View style={s.projectsColLeft}>
            {left.map((p, i) => (
              <View key={i} style={s.projectItem}>
                <Text style={s.projectBullet}>•</Text>
                <Text style={s.projectTitle}>{p.title}</Text>
              </View>
            ))}
          </View>
          <View style={s.projectsColRight}>
            {right.map((p, i) => (
              <View key={i} style={s.projectItem}>
                <Text style={s.projectBullet}>•</Text>
                <Text style={s.projectTitle}>{p.title}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View style={s.projectsOneCol}>
          {display.map((p, i) => (
            <View key={i} style={s.projectItem}>
              <Text style={s.projectBullet}>•</Text>
              <Text style={s.projectTitle}>{p.title}</Text>
            </View>
          ))}
        </View>
      )}

      {extra > 0 && (
        <Text style={s.projectsExtra}>+ {extra} Additional Project{extra !== 1 ? 's' : ''}</Text>
      )}
    </View>
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
  const stampUrl       = template?.stamp_url       ?? null
  const signatureUrl   = template?.signature_url   ?? null
  const signatoryName  = template?.signatory_name  ?? 'Emanoel Atef'
  const signatoryTitle = template?.signatory_title ?? 'CEO, Robocode School'

  const certId      = certificate.certificate_code
  const studentName = certificate.recipient_name
  // certificate.title is the immutable course-name snapshot stored at issuance.
  // Falls back to course_title join for legacy records where title may differ.
  const courseName  = certificate.title || certificate.course_title || '—'
  const dateStr     = formatDate(certificate.issued_at)
  const hours       = (certificate as any).course_hours as number | null | undefined
  const projects    = Array.isArray(certificate.projects) ? certificate.projects : []

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

        {/* ── Academy stamp overlay — position unchanged ── */}
        {stampUrl && (
          <View style={s.stampOverlay}>
            <Image src={stampUrl} style={s.stampOverlayImg} />
          </View>
        )}

        {/* ── Main content ── */}
        <View style={s.content}>

          {/* ─ HEADER ─ */}
          <View style={s.header}>
            <View style={s.logoRow}>
              <View style={s.circuitWrapper}>
                <CircuitDecoration />
              </View>
              <View style={{ flexShrink: 0 }}>
                {logoUrl
                  ? <Image src={logoUrl} style={s.logo} />
                  : <View style={{ width: 100, height: 78 }} />
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

            {/* Course name — prominently displayed below the cert title */}
            <Text style={s.courseNameLarge}>{courseName.toUpperCase()}</Text>
          </View>

          {/* ─ BODY ─ */}
          <View style={s.body}>
            <Text style={s.certifyText}>This certificate is proudly presented to</Text>

            <Text style={s.studentName}>{studentName}</Text>

            <View style={{ marginBottom: projects.length > 0 ? 4 : 12 }}>
              <GoldUnderline width={360} />
            </View>

            {projects.length > 0 && (
              <ProjectsSection projects={projects} />
            )}

            {/* Completion date / hours — shown below projects */}
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

          {/* ─ FOOTER ─ */}
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

              {/* Centre: STEM accreditation logo — slightly larger */}
              <View style={s.stemBlock}>
                {stemLogoUrl
                  ? <Image src={stemLogoUrl} style={s.stemLogo} />
                  : <View style={{ width: 66, height: 66 }} />
                }
              </View>

              {/* Right: Signature — position unchanged */}
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
