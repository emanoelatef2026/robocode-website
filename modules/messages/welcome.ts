// Welcome WhatsApp message — fixed template, no template system.
// buildWelcomeMessage() / canSendWelcomeMessage() are the only places this
// message is assembled; do not inline message generation in components.

export interface WelcomeMessagePayload {
  student_name:      string
  course_name:       string
  parent_email:      string
  parent_password:   string
  student_email:      string
  student_password:   string
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
  return `🌟 أهلاً بحضرتك في Robocode School

يسعدنا انضمام الطالب:

👦 الطالب: ${payload.student_name}
📚 الكورس: ${payload.course_name}

يمكنكم الآن متابعة رحلة الطالب التعليمية بالكامل من خلال منصة Robocode School.

━━━━━━━━━━━━━━
👨‍👩‍👦 حساب ولي الأمر

📧 البريد الإلكتروني:
${payload.parent_email}

🔐 كلمة المرور:
${payload.parent_password}

━━━━━━━━━━━━━━
👨‍💻 حساب الطالب

📧 البريد الإلكتروني:
${payload.student_email}

🔐 كلمة المرور:
${payload.student_password}

━━━━━━━━━━━━━━

من خلال البورتال يمكنكم:

✅ متابعة حضور الطالب
✅ متابعة التقدم والمستوى
✅ مشاهدة الواجبات والمشاريع
✅ متابعة عدد الحصص المتبقية
✅ الاطلاع على الشهادات والإنجازات
✅ التواصل بسهولة مع الأكاديمية

نتمنى للطالب رحلة تعليمية ممتعة ومليئة بالإنجازات 🚀

فريق Robocode School 💙
https://robocodeschools.com`
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
