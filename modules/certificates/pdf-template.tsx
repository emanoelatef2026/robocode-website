import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer'
import type { CertificateDetail } from './types'

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 48,
    fontFamily: 'Helvetica',
  },
  border: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    bottom: 16,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: '#FF8A1F',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoPlaceholder: {
    width: 80,
    height: 30,
    backgroundColor: '#FF8A1F',
    borderRadius: 4,
    marginBottom: 12,
  },
  orgName: {
    fontSize: 11,
    color: '#64748B',
    letterSpacing: 3,
    textTransform: 'uppercase',
  },
  divider: {
    height: 1,
    backgroundColor: '#FF8A1F',
    marginVertical: 20,
    opacity: 0.4,
  },
  certLabel: {
    fontSize: 10,
    color: '#64748B',
    letterSpacing: 2,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  certTitle: {
    fontSize: 22,
    color: '#0B1F3A',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 24,
  },
  presentedTo: {
    fontSize: 11,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 8,
  },
  recipientName: {
    fontSize: 30,
    color: '#FF8A1F',
    fontFamily: 'Helvetica-Bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  description: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 1.6,
    marginHorizontal: 40,
    marginBottom: 20,
  },
  contextRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 8,
  },
  contextItem: {
    alignItems: 'center',
  },
  contextLabel: {
    fontSize: 8,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 2,
  },
  contextValue: {
    fontSize: 10,
    color: '#0B1F3A',
    fontFamily: 'Helvetica-Bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 32,
  },
  signatoryBlock: {
    alignItems: 'center',
  },
  sigLine: {
    width: 120,
    height: 1,
    backgroundColor: '#0B1F3A',
    marginBottom: 4,
  },
  sigName: {
    fontSize: 10,
    color: '#0B1F3A',
    fontFamily: 'Helvetica-Bold',
  },
  sigTitle: {
    fontSize: 8,
    color: '#64748B',
  },
  qrBlock: {
    alignItems: 'center',
  },
  qrLabel: {
    fontSize: 7,
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
  },
  codeBlock: {
    alignItems: 'center',
    marginTop: 16,
  },
  codeLabel: {
    fontSize: 8,
    color: '#94A3B8',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  code: {
    fontSize: 11,
    color: '#0B1F3A',
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 2,
  },
})

interface Props {
  certificate: CertificateDetail
  qrDataUrl:   string
}

const TYPE_LABELS: Record<string, string> = {
  semester_completion: 'Certificate of Completion',
  course_completion:   'Certificate of Completion',
  competition_award:   'Certificate of Achievement',
  achievement:         'Certificate of Achievement',
  custom:              'Certificate',
}

export function CertificatePDF({ certificate, qrDataUrl }: Props) {
  const typeLabel    = TYPE_LABELS[certificate.certificate_type] ?? 'Certificate'
  const sigName      = certificate.template?.signatory_name ?? 'Robocode Academy'
  const sigTitle     = certificate.template?.signatory_title ?? 'Program Director'
  const issuedDate   = new Date(certificate.issued_at).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <View style={styles.border} />

        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoPlaceholder} />
          <Text style={styles.orgName}>Robocode Academy</Text>
        </View>

        <View style={styles.divider} />

        {/* Certificate type label */}
        <Text style={styles.certLabel}>{typeLabel}</Text>

        {/* Certificate title */}
        <Text style={styles.certTitle}>{certificate.title}</Text>

        {/* Recipient */}
        <Text style={styles.presentedTo}>This certificate is proudly presented to</Text>
        <Text style={styles.recipientName}>{certificate.recipient_name}</Text>

        {/* Description */}
        {certificate.description && (
          <Text style={styles.description}>{certificate.description}</Text>
        )}

        {/* Context: semester / course / date */}
        <View style={styles.contextRow}>
          {certificate.course_title && (
            <View style={styles.contextItem}>
              <Text style={styles.contextLabel}>Course</Text>
              <Text style={styles.contextValue}>{certificate.course_title}</Text>
            </View>
          )}
          {certificate.semester_name && (
            <View style={styles.contextItem}>
              <Text style={styles.contextLabel}>Semester</Text>
              <Text style={styles.contextValue}>{certificate.semester_name}</Text>
            </View>
          )}
          <View style={styles.contextItem}>
            <Text style={styles.contextLabel}>Date Issued</Text>
            <Text style={styles.contextValue}>{issuedDate}</Text>
          </View>
        </View>

        <View style={styles.divider} />

        {/* Footer: signatory + QR + code */}
        <View style={styles.footer}>
          <View style={styles.signatoryBlock}>
            <View style={styles.sigLine} />
            <Text style={styles.sigName}>{sigName}</Text>
            <Text style={styles.sigTitle}>{sigTitle}</Text>
          </View>

          <View style={styles.codeBlock}>
            <Text style={styles.codeLabel}>Certificate No.</Text>
            <Text style={styles.code}>{certificate.certificate_code}</Text>
          </View>

          <View style={styles.qrBlock}>
            <Image src={qrDataUrl} style={{ width: 56, height: 56 }} />
            <Text style={styles.qrLabel}>Scan to verify</Text>
          </View>
        </View>
      </Page>
    </Document>
  )
}
