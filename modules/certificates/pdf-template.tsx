import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { CertificateDetail } from './types'

// ─── Brand palette ────────────────────────────────────────────────────────────
const ORANGE = '#FF8A1F'
const NAVY   = '#0B1F3A'
const GRAY   = '#64748B'
const LIGHT  = '#94A3B8'
const PALE   = '#FFF7ED'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    paddingTop: 40,
    paddingBottom: 36,
    paddingHorizontal: 50,
    fontFamily: 'Helvetica',
    position: 'relative',
  },

  // ─── Decorative double border ───────────────────────────────────────────────
  borderOuter: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    bottom: 12,
    borderWidth: 3,
    borderStyle: 'solid',
    borderColor: ORANGE,
  },
  borderInner: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    bottom: 20,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: ORANGE,
  },

  // ─── Header row: Robocode logo | org name | (optional second logo) ──────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  logoMain: {
    height: 44,
    objectFit: 'contain',
  },
  logoPlaceholder: {
    width: 90,
    height: 36,
    backgroundColor: ORANGE,
    borderRadius: 4,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  orgName: {
    fontSize: 9,
    color: GRAY,
    letterSpacing: 3,
  },

  // ─── Horizontal rule ─────────────────────────────────────────────────────────
  rule: {
    height: 1.5,
    backgroundColor: ORANGE,
    marginBottom: 16,
    opacity: 0.6,
  },

  // ─── "CERTIFICATE" main heading ──────────────────────────────────────────────
  certHeading: {
    fontSize: 38,
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    letterSpacing: 10,
    marginBottom: 6,
  },

  // ─── Subtitle line: "OF FINISHING SEMESTER 1 OF SCRATCH JR" ────────────────
  certSubtitle: {
    fontSize: 11,
    color: NAVY,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: 18,
  },

  // ─── "IS PRESENTED TO" label ─────────────────────────────────────────────────
  presentedTo: {
    fontSize: 9,
    color: GRAY,
    textAlign: 'center',
    letterSpacing: 3,
    marginBottom: 8,
  },

  // ─── Recipient name ───────────────────────────────────────────────────────────
  recipientName: {
    fontSize: 32,
    color: ORANGE,
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 16,
  },

  // ─── Projects bullet list ─────────────────────────────────────────────────────
  projectsSection: {
    alignItems: 'center',
    marginBottom: 16,
  },
  projectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  projectBullet: {
    fontSize: 13,
    color: ORANGE,
    marginRight: 8,
    lineHeight: 1,
  },
  projectText: {
    fontSize: 11,
    color: NAVY,
  },

  // ─── Spacer ───────────────────────────────────────────────────────────────────
  flex1: {
    flex: 1,
  },

  // ─── Footer: 3 columns ────────────────────────────────────────────────────────
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 12,
  },

  // Bottom-left: Certificate ID + QR + URL
  verifyBlock: {
    alignItems: 'flex-start',
    width: 140,
  },
  certIdLabel: {
    fontSize: 7,
    color: LIGHT,
    letterSpacing: 1,
    marginBottom: 2,
  },
  certIdCode: {
    fontSize: 9,
    color: NAVY,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    marginBottom: 6,
  },
  qrImage: {
    width: 56,
    height: 56,
    marginBottom: 4,
  },
  verifyUrl: {
    fontSize: 6.5,
    color: GRAY,
  },

  // Bottom-center: STEM accreditation logo
  stemBlock: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  stemLogo: {
    height: 52,
    objectFit: 'contain',
  },
  stemPlaceholder: {
    width: 80,
    height: 40,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
  },

  // Bottom-right: official signature image only (no names or titles)
  signatureBlock: {
    alignItems: 'center',
    width: 140,
  },
  sigImage: {
    width: 110,
    height: 44,
    objectFit: 'contain',
    marginBottom: 4,
  },
  sigLine: {
    width: 130,
    height: 1,
    backgroundColor: NAVY,
  },
})

// ─── Helper: build subtitle from available DB fields ──────────────────────────
function buildSubtitle(cert: CertificateDetail): string {
  const parts: string[] = []
  if (cert.semester_name) parts.push(cert.semester_name.toUpperCase())
  if (cert.course_title)  parts.push(cert.course_title.toUpperCase())

  if (parts.length === 2) return `OF FINISHING ${parts[0]} OF ${parts[1]}`
  if (parts.length === 1) return `OF ${parts[0]}`
  return cert.title.toUpperCase()
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  certificate: CertificateDetail
  qrDataUrl:   string
}

// ─── Component ────────────────────────────────────────────────────────────────
export function CertificatePDF({ certificate, qrDataUrl }: Props) {
  const template    = certificate.template
  const accentColor = template?.accent_color ?? ORANGE
  const logoUrl     = template?.logo_url     ?? null
  const stemLogoUrl = template?.stem_logo_url ?? null
  const signatureUrl = template?.signature_url ?? null
  const bgColor     = template?.background_color ?? '#FFFFFF'

  const subtitle  = buildSubtitle(certificate)
  const verifyUrl = `robocodeschools.com/verify/${certificate.certificate_code}`

  const sortedProjects = (certificate.projects ?? [])
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order)

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={[styles.page, { backgroundColor: bgColor }]}>

        {/* Decorative double border */}
        <View style={[styles.borderOuter, { borderColor: accentColor }]} />
        <View style={[styles.borderInner, { borderColor: accentColor }]} />

        {/* ── Header: logo | "ROBOCODE ACADEMY" | (optional) ── */}
        <View style={styles.header}>
          {logoUrl ? (
            <Image src={logoUrl} style={styles.logoMain} />
          ) : (
            <View style={[styles.logoPlaceholder, { backgroundColor: accentColor }]} />
          )}

          <View style={styles.headerCenter}>
            <Text style={styles.orgName}>ROBOCODE ACADEMY</Text>
          </View>

          {/* Right side kept symmetrical — empty spacer matches logo width */}
          <View style={{ width: logoUrl ? undefined : 90, height: 36 }} />
        </View>

        {/* ── Horizontal rule ── */}
        <View style={[styles.rule, { backgroundColor: accentColor }]} />

        {/* ── "CERTIFICATE" heading ── */}
        <Text style={[styles.certHeading, { color: NAVY }]}>CERTIFICATE</Text>

        {/* ── Subtitle: "OF FINISHING SEMESTER 1 OF SCRATCH JR" ── */}
        <Text style={styles.certSubtitle}>{subtitle}</Text>

        {/* ── "IS PRESENTED TO" ── */}
        <Text style={styles.presentedTo}>IS PRESENTED TO</Text>

        {/* ── Recipient name ── */}
        <Text style={[styles.recipientName, { color: accentColor }]}>
          {certificate.recipient_name}
        </Text>

        {/* ── Projects as bullet list ── */}
        {sortedProjects.length > 0 && (
          <View style={styles.projectsSection}>
            {sortedProjects.map((p, i) => (
              <View key={i} style={styles.projectRow}>
                <Text style={[styles.projectBullet, { color: accentColor }]}>{'•'}</Text>
                <Text style={styles.projectText}>{p.title}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.flex1} />

        {/* ── Footer: 3 columns ── */}
        <View style={styles.footer}>

          {/* Left: Certificate ID + QR code + verification URL */}
          <View style={styles.verifyBlock}>
            <Text style={styles.certIdLabel}>Certificate ID:</Text>
            <Text style={styles.certIdCode}>{certificate.certificate_code}</Text>
            <Image src={qrDataUrl} style={styles.qrImage} />
            <Text style={styles.verifyUrl}>{verifyUrl}</Text>
          </View>

          {/* Center: STEM accreditation logo */}
          <View style={styles.stemBlock}>
            {stemLogoUrl ? (
              <Image src={stemLogoUrl} style={styles.stemLogo} />
            ) : (
              <View style={styles.stemPlaceholder} />
            )}
          </View>

          {/* Right: official signature image only — no names or titles */}
          <View style={styles.signatureBlock}>
            {signatureUrl ? (
              <Image src={signatureUrl} style={styles.sigImage} />
            ) : null}
            <View style={[styles.sigLine, { backgroundColor: NAVY }]} />
          </View>

        </View>
      </Page>
    </Document>
  )
}
