// Welcome WhatsApp message — fixed template, no template system.
// buildWelcomeMessage() / canSendWelcomeMessage() are the only places this
// message is assembled; do not inline message generation in components.

export interface WelcomeMessagePayload {
  student_name:      string
  course_name:       string
  branch_name:       string
  parent_email:      string
  parent_password:   string
  student_email:      string
  student_password:   string
}

export interface WelcomeMessageEligibility {
  eligible: boolean
  reason:   string | null
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

const PORTAL_URL = 'https://portal.robocodeschool.com'

export function buildWelcomeMessage(payload: WelcomeMessagePayload): string {
  return `🌟 أهلاً بحضرتك في Robocode School

يسعدنا انضمام الطالب:

👦 الطالب: ${payload.student_name}
📚 الكورس: ${payload.course_name}
🏫 الفرع: ${payload.branch_name}

يمكنكم الآن متابعة رحلة الطالب التعليمية بالكامل من خلال منصة Robocode School.

━━━━━━━━━━━━━━
👨‍👩‍👦 حساب ولي الأمر

📧 البريد الإلكتروني:
${payload.parent_email}

🔐 كلمة المرور:
${payload.parent_password}

🔗 رابط البورتال:
${PORTAL_URL}

━━━━━━━━━━━━━━
👨‍💻 حساب الطالب

📧 البريد الإلكتروني:
${payload.student_email}

🔐 كلمة المرور:
${payload.student_password}

🔗 رابط البورتال:
${PORTAL_URL}

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
    return { eligible: false, reason: 'Parent phone number is missing.' }
  }
  if (!input.parentEmail || !input.parentPassword) {
    return { eligible: false, reason: 'Parent portal account has not been created yet.' }
  }
  if (!input.studentEmail || !input.studentPassword) {
    return { eligible: false, reason: 'Student portal account has not been created yet.' }
  }
  return { eligible: true, reason: null }
}
