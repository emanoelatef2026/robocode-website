// Canonical contact utility module.
// All phone normalization and contact link generation must go through here.
// lib/phone.ts re-exports from this file for backward compat.

// ── E.164 normalization ───────────────────────────────────────────────────────

/**
 * Normalize an Egyptian mobile number to E.164 format WITHOUT the leading '+'.
 * Handled forms:
 *   010xxxxxxxx  (11 digits, local)  → 2010xxxxxxxx
 *   20xxxxxxxxxx (12 digits, E.164)  → passthrough
 *   10xxxxxxxx   (10 digits)         → 2010xxxxxxxx
 *   +20xxxxxxxxx (stripped then normalized)
 * Unrecognized formats are returned with non-digits stripped.
 */
export function normalizeEgyptPhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('20') && digits.length === 12) return digits
  if (digits.length === 11 && /^0(10|11|12|15)/.test(digits)) return `2${digits}`
  if (digits.length === 10 && /^(10|11|12|15)/.test(digits))  return `20${digits}`
  return digits
}

// ── Link builders ─────────────────────────────────────────────────────────────

/**
 * Build a WhatsApp deep-link (wa.me).
 * Priority: parentPhone → studentPhone.
 * Returns null if no usable phone found.
 */
export function buildWhatsAppUrl(
  parentPhone:  string | null | undefined,
  studentPhone: string | null | undefined,
): string | null {
  const normalized = normalizeEgyptPhone(parentPhone) ?? normalizeEgyptPhone(studentPhone)
  if (!normalized) return null
  return `https://wa.me/${normalized}`
}

/**
 * Build a WhatsApp deep-link with a pre-filled message.
 * Priority: parentPhone → studentPhone.
 */
export function buildWhatsAppUrlWithContext(
  parentPhone:  string | null | undefined,
  studentPhone: string | null | undefined,
  studentName?: string,
  context?:     string,
): string | null {
  const base = buildWhatsAppUrl(parentPhone, studentPhone)
  if (!base) return null
  if (!context && !studentName) return base
  const text = context
    ? `Hi, this is Robocode regarding ${studentName ?? 'your student'}. ${context}`
    : `Hi, this is Robocode regarding ${studentName ?? 'your student'}.`
  return `${base}?text=${encodeURIComponent(text)}`
}

/**
 * Build a tel: URI for the native dialler.
 * Priority: parentPhone → studentPhone.
 * Returns null if no usable phone found.
 */
export function buildTelUrl(
  parentPhone:  string | null | undefined,
  studentPhone: string | null | undefined,
): string | null {
  const normalized = normalizeEgyptPhone(parentPhone) ?? normalizeEgyptPhone(studentPhone)
  if (!normalized) return null
  return `tel:+${normalized}`
}

// ── Display helpers ───────────────────────────────────────────────────────────

/**
 * Format a phone number for human-readable display.
 * Egyptian mobiles: 010 xxxx xxxx
 * Falls back to raw value if unrecognized.
 */
export function formatPhoneDisplay(raw: string | null | undefined): string | null {
  if (!raw) return null
  const normalized = normalizeEgyptPhone(raw)
  if (!normalized) return raw
  // 12-digit E.164 Egyptian: 2010XXXXXXXX → 010 XXXX XXXX
  if (normalized.startsWith('20') && normalized.length === 12) {
    const local = normalized.slice(1)           // 010XXXXXXXX
    return `${local.slice(0, 3)} ${local.slice(3, 7)} ${local.slice(7)}`
  }
  return raw
}

/**
 * Returns the priority phone (parent first, student fallback) with source metadata.
 */
export function getContactPhone(
  parentPhone:  string | null | undefined,
  studentPhone: string | null | undefined,
): { phone: string; source: 'parent' | 'student' } | null {
  if (parentPhone) {
    const n = normalizeEgyptPhone(parentPhone)
    if (n) return { phone: n, source: 'parent' }
  }
  if (studentPhone) {
    const n = normalizeEgyptPhone(studentPhone)
    if (n) return { phone: n, source: 'student' }
  }
  return null
}
