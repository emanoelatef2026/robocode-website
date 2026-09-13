import React from 'react'
import { Document, Page, Text, View, Image, StyleSheet, Font, renderToFile } from '@react-pdf/renderer'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'docs', 'guides', 'robocode-certificate-download-guide-ar.pdf')
const logoData = `data:image/png;base64,${readFileSync(path.join(root, 'public', 'logo.png')).toString('base64')}`

Font.register({ family: 'Arial', src: 'C:/Windows/Fonts/arial.ttf' })
Font.register({ family: 'ArialBold', src: 'C:/Windows/Fonts/arialbd.ttf' })

const C = {
  navy: '#0B1F3A', orange: '#FF8A1F', slate: '#475569', muted: '#64748B',
  line: '#E2E8F0', soft: '#F8FAFC', green: '#15803D', greenBg: '#E7F8EE',
}

const s = StyleSheet.create({
  page: { paddingTop: 42, paddingBottom: 42, paddingHorizontal: 46, fontFamily: 'Arial', color: C.navy, backgroundColor: '#FFFFFF' },
  cover: { backgroundColor: C.navy, paddingTop: 58, paddingBottom: 50, paddingHorizontal: 48, color: '#FFFFFF' },
  logo: { width: 150, height: 45, objectFit: 'contain', marginBottom: 32 },
  coverTitle: { fontFamily: 'ArialBold', fontSize: 28, lineHeight: 1.3, textAlign: 'right', direction: 'rtl', marginBottom: 14 },
  coverSub: { fontSize: 14, lineHeight: 1.7, textAlign: 'right', direction: 'rtl', color: '#DCE6F2' },
  coverCard: { marginTop: 48, padding: 20, borderRadius: 14, backgroundColor: '#FFFFFF', color: C.navy },
  coverCardTitle: { fontFamily: 'ArialBold', fontSize: 16, textAlign: 'right', direction: 'rtl', marginBottom: 8 },
  coverCardText: { fontSize: 12, lineHeight: 1.7, textAlign: 'right', direction: 'rtl', color: C.slate },
  kicker: { fontSize: 10, letterSpacing: 1.2, color: C.orange, textAlign: 'right', direction: 'rtl', marginBottom: 7 },
  title: { fontFamily: 'ArialBold', fontSize: 23, lineHeight: 1.3, textAlign: 'right', direction: 'rtl', marginBottom: 8 },
  intro: { fontSize: 11.5, lineHeight: 1.8, textAlign: 'right', direction: 'rtl', color: C.slate, marginBottom: 17 },
  section: { marginTop: 8, marginBottom: 16, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.soft },
  sectionTitle: { fontFamily: 'ArialBold', fontSize: 15, textAlign: 'right', direction: 'rtl', marginBottom: 10 },
  step: { flexDirection: 'row-reverse', alignItems: 'flex-start', marginBottom: 11 },
  number: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.orange, color: '#FFFFFF', fontFamily: 'ArialBold', fontSize: 12, textAlign: 'center', paddingTop: 5, marginLeft: 9 },
  stepBody: { flex: 1 },
  stepTitle: { fontFamily: 'ArialBold', fontSize: 12.5, textAlign: 'right', direction: 'rtl', marginBottom: 3 },
  stepText: { fontSize: 10.5, lineHeight: 1.65, textAlign: 'right', direction: 'rtl', color: C.slate },
  badge: { alignSelf: 'flex-end', marginTop: 5, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 8, backgroundColor: '#FFF7ED', color: '#C2410C', fontSize: 10, textAlign: 'right', direction: 'rtl' },
  callout: { marginTop: 13, padding: 12, borderRadius: 10, backgroundColor: C.greenBg, borderWidth: 1, borderColor: '#A7F3D0' },
  calloutText: { fontSize: 10.5, lineHeight: 1.7, textAlign: 'right', direction: 'rtl', color: C.green },
  trouble: { padding: 12, marginBottom: 9, borderRadius: 10, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.line },
  troubleQ: { fontFamily: 'ArialBold', fontSize: 11, textAlign: 'right', direction: 'rtl', marginBottom: 4 },
  troubleA: { fontSize: 10, lineHeight: 1.65, textAlign: 'right', direction: 'rtl', color: C.slate },
  footer: { position: 'absolute', bottom: 20, left: 46, right: 46, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { fontSize: 8, color: '#94A3B8' },
  ltr: { direction: 'ltr', fontFamily: 'ArialBold' },
})

function Step({ n, title, children, badge }) {
  return React.createElement(View, { style: s.step },
    React.createElement(Text, { style: s.number }, String(n)),
    React.createElement(View, { style: s.stepBody },
      React.createElement(Text, { style: s.stepTitle }, title),
      React.createElement(Text, { style: s.stepText }, children),
      badge ? React.createElement(Text, { style: s.badge }, badge) : null,
    ),
  )
}

function Footer({ page }) {
  return React.createElement(View, { style: s.footer, fixed: true },
    React.createElement(Text, { style: s.footerText }, 'Robocode School · Certificate Guide'),
    React.createElement(Text, { style: s.footerText }, `صفحة ${page}`),
  )
}

function Guide() {
  return React.createElement(Document, { title: 'دليل الحصول على الشهادة وتحميلها', author: 'Robocode School' },
    React.createElement(Page, { size: 'A4', style: s.cover },
      React.createElement(Image, { src: logoData, style: s.logo }),
      React.createElement(Text, { style: { ...s.coverTitle, direction: 'ltr', textAlign: 'center' } }, 'Certificate Download Guide'),
      React.createElement(View, { style: s.coverCard },
        React.createElement(Text, { style: s.coverCardTitle }, 'قبل البدء'),
        React.createElement(Text, { style: { fontSize: 13, lineHeight: 1.6, textAlign: 'center', color: C.slate } }, 'Login  →  Certificates  →  Download PDF'),
      ),
    ),

    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.kicker }, 'أولًا · حساب الطالب'),
      React.createElement(Text, { style: s.title }, 'طريقة فتح الشهادة وتحميلها للطالب'),
      React.createElement(Text, { style: s.intro }, 'اتبع الخطوات التالية من الموبايل أو الكمبيوتر. زر Download PDF يفتح ملف الشهادة لتتمكن من حفظه أو طباعته.'),
      React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, 'الخطوات'),
        React.createElement(Step, { n: 1, title: 'سجّل الدخول إلى حساب الطالب' }, 'افتح بوابة النظام وسجّل الدخول باستخدام بيانات الطالب.'),
        React.createElement(Step, { n: 2, title: 'افتح صفحة Certificates' }, 'من القائمة الجانبية اختر Certificates. على الموبايل افتح More ثم اختر Certificates.'),
        React.createElement(Step, { n: 3, title: 'راجع حالة الشهادة' }, 'ستظهر حالة التقدم أعلى الصفحة. إذا لم تكتمل الدورة أو الجلسات المطلوبة، ستظهر رسالة Not Yet Eligible.'),
        React.createElement(Step, { n: 4, title: 'اختر الشهادة المطلوبة' }, 'في قائمة الشهادات راجع اسم الشهادة، نوعها، تاريخ إصدارها، وكود الشهادة.'),
        React.createElement(Step, { n: 5, title: 'حمّل ملف الشهادة', badge: 'Download PDF' }, 'اضغط Download PDF. سيفتح ملف PDF في تبويب جديد؛ استخدم زر التحميل في المتصفح لحفظه على جهازك.'),
        React.createElement(Step, { n: 6, title: 'تحقق من صحة الشهادة عند الحاجة' }, 'اضغط Verify لفتح صفحة التحقق العامة باستخدام كود الشهادة. يمكن مشاركة رابط التحقق مع أي جهة.'),
      ),
      React.createElement(View, { style: s.callout },
        React.createElement(Text, { style: s.calloutText }, 'نصيحة: احتفظ بنسخة من ملف PDF في الهاتف أو Google Drive، ولا تشارك بيانات تسجيل الدخول مع أي شخص.'),
      ),
      React.createElement(Footer, { page: 2 }),
    ),

    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.kicker }, 'ثانيًا · حساب ولي الأمر'),
      React.createElement(Text, { style: s.title }, 'طريقة تحميل شهادة أحد الأبناء لولي الأمر'),
      React.createElement(Text, { style: s.intro }, 'يمكن لولي الأمر متابعة أكثر من طالب مرتبط بالحساب. يجب اختيار الطالب الصحيح قبل تحميل الشهادة حتى لا يتم فتح شهادة طالب آخر.'),
      React.createElement(View, { style: s.section },
        React.createElement(Text, { style: s.sectionTitle }, 'الخطوات'),
        React.createElement(Step, { n: 1, title: 'سجّل الدخول إلى Parent Portal' }, 'افتح بوابة النظام وسجّل الدخول بحساب ولي الأمر.'),
        React.createElement(Step, { n: 2, title: 'اختر الطالب' }, 'من شريط اختيار الأبناء أعلى الصفحة، اضغط على اسم الطالب المطلوب.'),
        React.createElement(Step, { n: 3, title: 'افتح Certificates' }, 'من القائمة الجانبية اختر Certificates. على الموبايل افتح More ثم اختر Certificates.'),
        React.createElement(Step, { n: 4, title: 'راجع اسم الطالب أعلى الصفحة' }, 'تأكد أن اسم الطالب الظاهر بجوار عنوان Certificates هو الطالب الصحيح قبل الضغط على أي زر.'),
        React.createElement(Step, { n: 5, title: 'حمّل الشهادة', badge: 'Download PDF' }, 'من بطاقة الشهادة اضغط Download PDF. سيفتح الملف في تبويب جديد ويمكن حفظه أو طباعته.'),
        React.createElement(Step, { n: 6, title: 'تحقق من الشهادة' }, 'اضغط Verify لعرض صفحة التحقق باستخدام كود الشهادة الموجود داخل بطاقة الشهادة.'),
      ),
      React.createElement(View, { style: s.callout },
        React.createElement(Text, { style: s.calloutText }, 'مهم: إذا كان لديك أكثر من ابن، كرر الخطوتين 2 و3 لكل طالب تريد تحميل شهادته.'),
      ),
      React.createElement(Footer, { page: 3 }),
    ),

    React.createElement(Page, { size: 'A4', style: s.page },
      React.createElement(Text, { style: s.kicker }, 'حل المشكلات'),
      React.createElement(Text, { style: s.title }, 'لو الشهادة لا تظهر أو لا يتم تحميلها'),
      React.createElement(Text, { style: s.intro }, 'راجع الحالات التالية بالترتيب قبل التواصل مع إدارة الأكاديمية.'),
      React.createElement(View, { style: s.trouble },
        React.createElement(Text, { style: s.troubleQ }, 'لا توجد شهادة في الصفحة'),
        React.createElement(Text, { style: s.troubleA }, 'تأكد من إكمال الجلسات أو الدورة المطلوبة، وتأكد من اختيار الطالب الصحيح في حساب ولي الأمر. الشهادة تظهر بعد إصدارها من الأكاديمية.'),
      ),
      React.createElement(View, { style: s.trouble },
        React.createElement(Text, { style: s.troubleQ }, 'ظهرت رسالة Not Yet Eligible'),
        React.createElement(Text, { style: s.troubleA }, 'هذا يعني أن متطلبات الحصول على الشهادة لم تكتمل بعد. راجع نسبة التقدم وعدد الجلسات المتبقية في بطاقة Certificate Eligibility.'),
      ),
      React.createElement(View, { style: s.trouble },
        React.createElement(Text, { style: s.troubleQ }, 'زر Download PDF لا يفتح الملف'),
        React.createElement(Text, { style: s.troubleA }, 'تأكد من اتصال الإنترنت، اسمح بفتح التبويبات الجديدة في المتصفح، ثم جرّب مرة أخرى. يمكن أيضًا تجربة متصفح Chrome أو Safari.'),
      ),
      React.createElement(View, { style: s.trouble },
        React.createElement(Text, { style: s.troubleQ }, 'الشهادة مفتوحة لكن لا أعرف كيف أحفظها'),
        React.createElement(Text, { style: s.troubleA }, 'من الهاتف اضغط زر المشاركة أو قائمة المتصفح ثم Save to Files / Download. من الكمبيوتر اضغط رمز التحميل أعلى عارض PDF.'),
      ),
      React.createElement(View, { style: s.trouble },
        React.createElement(Text, { style: s.troubleQ }, 'بيانات الشهادة غير صحيحة'),
        React.createElement(Text, { style: s.troubleA }, 'لا تحمّل أو تشارك النسخة الخاطئة. تواصل مع إدارة الأكاديمية لتصحيح بيانات الطالب ثم أعد فتح صفحة Certificates وتحميل النسخة الجديدة.'),
      ),
      React.createElement(View, { style: s.callout },
        React.createElement(Text, { style: s.calloutText }, 'للمساعدة: أرسل اسم الطالب وكود الشهادة الظاهر في الصفحة إلى إدارة الأكاديمية، ولا ترسل كلمة المرور.'),
      ),
      React.createElement(Footer, { page: 4 }),
    ),
  )
}

await fsMkdir(path.dirname(out))
await renderToFile(React.createElement(Guide), out)
console.log(out)

async function fsMkdir(dir) {
  const { mkdir } = await import('node:fs/promises')
  await mkdir(dir, { recursive: true })
}
