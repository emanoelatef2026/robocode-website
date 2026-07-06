// Generates unique @robocodeschools.com login handles for every account in the
// system. These are not real mailboxes — just a short, unique, domain-locked
// identifier used for Supabase Auth login. See docs/MIGRATIONS.md context:
// migration that added the enforcing DB trigger references this convention.

export const ORG_EMAIL_DOMAIN = 'robocodeschools.com'

const ARABIC_TRANSLITERATION: Record<string, string> = {
  'ا': 'a', 'أ': 'a', 'إ': 'a', 'آ': 'a', 'ى': 'a', 'ة': 'a',
  'ب': 'b', 'ت': 't', 'ث': 'th', 'ج': 'g', 'ح': 'h', 'خ': 'kh',
  'د': 'd', 'ذ': 'z', 'ر': 'r', 'ز': 'z', 'س': 's', 'ش': 'sh',
  'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
  'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
  'ه': 'h', 'و': 'w', 'ي': 'y', 'ئ': 'e', 'ء': 'a', 'ؤ': 'o',
}

const ARABIC_DIACRITICS = /[ً-ٰٟ]/g

/** Best-effort ASCII transliteration — exact spelling doesn't matter, only uniqueness. */
function transliterate(text: string): string {
  const stripped = text.normalize('NFKD').replace(ARABIC_DIACRITICS, '')
  let out = ''
  for (const ch of stripped) {
    out += ARABIC_TRANSLITERATION[ch] ?? ch
  }
  return out
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

function firstWord(text: string): string {
  return text.trim().split(/\s+/)[0] ?? ''
}

/**
 * Normalizes whatever someone types into the login field into a full address:
 * appends `@robocodeschools.com` when they only typed the local part (the
 * common case, since the domain is fixed and never needs to be typed), and
 * leaves a full address (or anything already containing `@`) untouched.
 */
export function normalizeLoginIdentifier(raw: string): string {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed || trimmed.includes('@')) return trimmed
  return `${trimmed}@${ORG_EMAIL_DOMAIN}`
}

/**
 * Builds a unique `local-part@robocodeschools.com` login address from a person's name.
 *
 * - `staff`:   initials(first name) + '.' + first word of last name — starts at
 *              1 initial, expands to 2 then 3 on collision, then falls back to
 *              a numeric suffix.
 * - `learner`: first 2 letters of first name + '.' + first word of last name —
 *              appends a 2-digit numeric suffix on collision.
 *
 * `exists` checks whether a candidate local-part is already taken.
 */
interface EmailLookupClient {
  from(table: 'users'): {
    select(columns: string): {
      ilike(column: string, pattern: string): {
        maybeSingle(): PromiseLike<{ data: { id: string } | null }>
      }
    }
  }
}

/** Reusable `exists` check against `public.users.email` for `generateUniqueLoginEmail`. */
export function makeEmailLocalPartExists(db: EmailLookupClient) {
  return async (localPart: string): Promise<boolean> => {
    const { data } = await db.from('users').select('id').ilike('email', `${localPart}@${ORG_EMAIL_DOMAIN}`).maybeSingle()
    return !!data
  }
}

export async function generateUniqueLoginEmail(
  kind: 'staff' | 'learner',
  firstName: string,
  lastName: string,
  exists: (localPart: string) => Promise<boolean>
): Promise<string> {
  const first = transliterate(firstName) || 'user'
  const second = transliterate(firstWord(lastName)) || 'account'

  if (kind === 'staff') {
    for (let initials = 1; initials <= 3; initials++) {
      const local = `${first.slice(0, initials)}.${second}`
      if (!(await exists(local))) return `${local}@${ORG_EMAIL_DOMAIN}`
    }
    const base = `${first.slice(0, 3)}.${second}`
    let n = 1
    while (await exists(`${base}${n}`)) n++
    return `${base}${n}@${ORG_EMAIL_DOMAIN}`
  }

  const base = `${first.slice(0, 2)}.${second}`
  if (!(await exists(base))) return `${base}@${ORG_EMAIL_DOMAIN}`
  let n = 1
  let candidate = `${base}${String(n).padStart(2, '0')}`
  while (await exists(candidate)) {
    n++
    candidate = `${base}${String(n).padStart(2, '0')}`
  }
  return `${candidate}@${ORG_EMAIL_DOMAIN}`
}
