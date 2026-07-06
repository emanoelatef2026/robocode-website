// Welcome WhatsApp message — fixed template, no template system.
// buildWelcomeMessage() / canSendWelcomeMessage() are the only places this
// message is assembled; do not inline message generation in components.

export interface WelcomeMessagePayload {
  student_name:      string
  parent_email:      string
  parent_password:   string
  student_email:     string
  student_password:  string
}

export interface WelcomeMessageEligibility {
  eligible:      boolean
  reason:        string | null
  // True when the only blocking issue is a missing portal password on an
  // account that already exists (email present) — recoverable via credential
  // regeneration, unlike a genuinely missing account which needs full setup.
  canRegenerate: boolean
}

export interface WelcomeMessageLog {
  id:           string
  student_id:   string
  parent_phone: string
  sent_by:      string
  sent_at:      string
  channel:      string
  message_type: string
  created_at:   string | null
}

export function buildWelcomeMessage(payload: WelcomeMessagePayload): string {
  return `🚀 Welcome to Robocode School!

Your portal accounts have been created successfully.

👨‍🎓 Student Account
👦 Name: ${payload.student_name}
📧 Email: ${payload.student_email}
🔒 Password: ${payload.student_password}

👨‍👩‍👧 Parent Account
📧 Email: ${payload.parent_email}
🔒 Password: ${payload.parent_password}

🌐 Login:
https://robocodeschools.com

Please change your password after your first login to keep your account secure.

For any assistance, feel free to contact us.

Robocode School
Code • Build • Invent • Solve 🚀`
}

export function canSendWelcomeMessage(input: {
  parentPhone:     string | null
  parentEmail:     string | null
  parentPassword:  string | null
  studentEmail:    string | null
  studentPassword: string | null
}): WelcomeMessageEligibility {
  if (!input.parentPhone) {
    return { eligible: false, reason: 'Parent phone number is missing.', canRegenerate: false }
  }
  // Email and password are checked separately — an account with an email but
  // no password is a DIFFERENT failure than no account at all, and only the
  // former is safely recoverable (regenerate password vs. create account).
  if (!input.parentEmail) {
    return { eligible: false, reason: 'Parent portal account has not been created yet.', canRegenerate: false }
  }
  if (!input.parentPassword) {
    return { eligible: false, reason: 'Parent portal password has not been set yet.', canRegenerate: true }
  }
  if (!input.studentEmail) {
    return { eligible: false, reason: 'Student portal account has not been created yet.', canRegenerate: false }
  }
  if (!input.studentPassword) {
    return { eligible: false, reason: 'Student portal password has not been set yet.', canRegenerate: true }
  }
  return { eligible: true, reason: null, canRegenerate: false }
}
