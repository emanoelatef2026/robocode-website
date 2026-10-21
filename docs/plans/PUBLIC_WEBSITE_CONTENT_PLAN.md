# Robocode School — Public Website Content & Rollout Plan

Prepared: 2026-10-21. Status: **content draft for review; not published**.

This document implements planning/content task 1 only. Approved commercial facts come from the owner's messages and the four supplied curriculum posters. Wording and section order below are editorial proposals pending review. No website components, images, production data, portals, contracts, or payment functions were changed.

## 1. Approved facts / البيانات المعتمدة

| Field | Arabic | English |
|---|---|---|
| Brand | Robocode School؛ وصف النشاط: الأكاديمية | Robocode School; describe the business as an academy |
| Age groups | 6–8، 9–11، 12–14، 15–17 سنة | Ages 6–8, 9–11, 12–14, 15–17 |
| Advertised delivery | أونلاين، حصص مباشرة | Live online classes |
| Lesson length | ساعة ونصف | 90 minutes |
| Semester | 12 حصة على مدار 3 شهور، حصة أسبوعيًا | 12 classes over 3 months, one class per week |
| Group | من 2 إلى 4 طلاب؛ 2,800 جنيه للطالب لكل سيمستر | 2–4 students; EGP 2,800 per student, per semester |
| One-to-one | طالب واحد مع المدرب؛ 5,200 جنيه لكل سيمستر | One student with the instructor; EGP 5,200 per semester |
| Certificate | شهادة معتمدة من STEM بعد كل سيمستر | A STEM-accredited certificate after each semester |
| Roadmap | 4 سيمسترات لكل مرحلة؛ ترتيب المنهج من الصور | 4 semesters per age-group pathway; order follows the supplied posters |
| Price scope | السعر لسيمستر واحد؛ ليس للمسار الكامل | Price covers one semester, not the complete pathway |
| Payments | لا دفع إلكتروني أو Checkout في هذه الدفعات | No online payment or checkout in these releases |

Owner-confirmed certificate wording is used as provided; this task did not independently verify accreditation. Do not broaden it into university credits, endorsement by every listed platform, worldwide certificate recognition, or certification of each instructor.

The three-month schedule is the advertised semester format, not a promise that all four semesters finish on a particular calendar date. Do not add installment, tax-inclusive, discount, refund, kit, or software-license promises without separate approval.

## 2. Verified current code / الوضع الحالي

These are source observations, not a fresh production database audit. Earlier live evidence is in `.gstack/qa-reports/2026-10-21-public-site/REPORT-AR.md`.

| Existing area | Verified behavior | Consequence for implementation |
|---|---|---|
| `app/page.tsx:10`, `:35` | Default section list plus `homepage_sections` enabled/order settings | Changing a component alone does not guarantee the live section appears; verify publishing settings during implementation. No settings changed now. |
| `components/HomeSections.tsx:22` | Dispatches `programs` and `learning_journey` independently; no pricing entry | Avoid two conflicting catalogs; explicitly integrate pricing into the homepage render sequence. |
| `components/ProgramsSection.tsx:23` | Eight English hard-coded topic cards, including Roblox, robotics, Minecraft, VR and React; no detail-page CTA | Replace the public online offer with the four approved age pathways, not a newly invented topic catalog. Do not remove those subjects from LMS courses. |
| `components/LearningJourneySection.tsx:11`, `:28`, `:92` | Single-language title/description, static fallback plus API replacement; fallback last age is15–18 | Old remote/fallback text must not overwrite approved bilingual content or restore old ages. |
| `app/api/learning-journey/route.ts:7` | Reads active `learning_journey_stages`; returns an empty list on error | Content shown may differ from source fallback. Do not infer exact live rows from source. |
| `app/studio/(dashboard)/learning-journey/page.tsx:8` | Studio form has one title and description, not paired AR/EN fields | Do not promise bilingual CMS editing already exists. Public catalog can initially be isolated from this legacy source. |
| `components/Navbar.tsx:52` | Navigation points to fixed section anchors; missing targets cause silent return | Programs should target the real pathway section. Prices needs an actual `#pricing` target before linking. |
| `components/Footer.tsx:26` | Topic links all target `/#programs` | Replace footer program labels with four age pathways and real details links in the later UI task. |
| `messages/en.json:22`, `messages/ar.json` | Hero still promotes6–18 | Update public catalog copy to6–17 consistently. |
| `components/TrialForm.tsx:50`, `:195` | Form lacks pathway/plan context; public age bounds4–18 | Future public booking changes must preserve valid selected context and use approved catalog ages, without changing student registration rules in the LMS. |
| `contexts/LanguageContext.tsx:37` | Starts EN, then restores locale from localStorage and changes root direction | Explains risk of a late language/layout change; shared provider also affects portals, so isolate public changes or require separate regression coverage. No shared-provider changes in task1. |
| `app/layout.tsx:37` | Metadata base is `robocodeschool.com`, while the audited production domain is `robocodeschools.com` | Flag the domain mismatch for metadata review; do not silently change a shared root layout during content preparation. |

No existing public program-detail page was found in the route inventory. Admin/team-leader course pages are operational LMS routes and must not be reused as marketing pages.

## 3. Proposed homepage structure / ترتيب الرئيسية

The course catalog and prices are both **on the homepage**, not hidden behind a separate pricing page.

| Order | Section | Proposed purpose |
|---:|---|---|
| 1 | Header | Home / Learning Pathways / Online Prices / Branches; login and trial CTA. Only retain extra links with visible, working destinations. Legal links stay in the footer. |
| 2 | Hero | Brand promise + programming/AI/games/web/apps, ages6–17. Primary CTA explores pathways; secondary CTA books a trial. |
| 3 | Trust strip | Keep verified existing facts/accreditation only; no invented student totals or testimonials. |
| 4 | Four learning pathways `#programs` | Age, title, short description, tool examples, course-format summary, link to details. |
| 5 | Study & progress | Weekly live classes, practical work, LMS progress and digital project portfolio, certificate. |
| 6 | Online prices `#pricing` | Side-by-side group and one-to-one cards, full per-semester price, schedule, exclusions note, non-payment CTA. |
| 7 | Student work / outcomes | Publish genuine consented work when available; do not substitute invented projects or competition outcomes. |
| 8 | Why Robocode / accreditation / partnerships | Compact factual proof, not repeated general promises. |
| 9 | Branches `#branches` | Physical branches remain visible; make clear that these published prices are online-only. |
| 10 | FAQ `#faq` | Eligibility, semester length, pricing unit, group size, pathways, certificate, booking. |
| 11 | Contact `#contact` | One final action to book or contact the academy. |
| 12 | Footer | Four pathway links, online prices, contact and existing policy links. |

Do not repeat the full four-semester roadmap in a second large homepage section. Legacy `#learning-journey` should retain a compatible destination/short overview if linked externally, rather than creating a second conflicting catalog. Full roadmaps belong on pathway detail pages.

For partial releases: do not ship a details button pointing at a404. Either release the four pages with the homepage, or temporarily label the secondary action as an inquiry and send it to a working contact/trial destination. Final labels below assume detail pages exist.

## 4. Homepage copy / محتوى الرئيسية

### 4.1 Hero

**AR heading:** نحن لا نعلّم الأطفال كيف يستخدمون التكنولوجيا؛ نعلّمهم كيف يبنونها.

**AR body:** مسارات أونلاين في البرمجة والذكاء الاصطناعي وتصميم الألعاب والمواقع والتطبيقات، للأعمار من 6 إلى 17 سنة. يتعلّم طفلك خطوة بخطوة ويحوّل أفكاره إلى مشروعات عملية.

**EN heading:** We don't just teach children to use technology. We teach them to build it.

**EN body:** Live online pathways in coding, AI, game design, websites and apps for ages 6–17. Your child learns step by step and brings ideas to life through practical projects.

**Actions:** اكتشف المسار المناسب / Explore the Pathways; احجز تجربة أونلاين / Book an Online Trial.

### 4.2 Pathway section introduction

**AR heading:** مسار يناسب سن طفلك، ومهارات تتطور مع كل سيمستر.

**AR body:** اكتشف المراحل التعليمية الأربع، من أول أوامر البرمجة إلى تطبيقات الذكاء الاصطناعي والمواقع والموبايل. اطّلع على تفاصيل كل مرحلة ورحلة التعلّم داخلها.

**EN heading:** A pathway for your child's age. Skills that grow each semester.

**EN body:** Explore four learning pathways, from first coding steps to AI applications, websites and mobile apps. Discover the tools, skills and semester roadmap for each age group.

**Shared format line:** أونلاين مباشر · 12 حصة لكل سيمستر · 90 دقيقة للحصة / Live online · 12 classes per semester · 90 minutes per class.

### 4.3 Study and progress

| AR title | AR body | EN title | EN body |
|---|---|---|---|
| تعلّم مباشر كل أسبوع | حصة أونلاين أسبوعيًا لمدة ساعة ونصف، ضمن سيمستر من 12 حصة. | Live learning every week | A weekly 90-minute online class within a 12-class semester. |
| تطبيق ومشروعات | يتدرّب الطالب على المهارات من خلال أنشطة ومشروعات مرتبطة بكل سيمستر. | Learn by building | Students practise their skills through activities and projects aligned with each semester. |
| متابعة تقدّم واضحة | متابعة مستوى الطالب وتقدّمه عبر منصة LMS، مع بورتفوليو رقمي لمشروعاته. | Visible progress | Track learning progress through the LMS and a digital portfolio of the student's projects. |
| شهادة لكل سيمستر | شهادة معتمدة من STEM بعد كل سيمستر. | A certificate each semester | A STEM-accredited certificate after each semester. |

No unapproved promises of recorded classes,24/7 support, private parent coaching, instructor credentials, or competition entry are added.

### 4.4 Pricing copy

**AR heading:** أسعار الأونلاين، واضحة من البداية.

**AR intro:** اختر التعلّم ضمن مجموعة صغيرة أو حصصًا فردية مع المدرب. الأسعار التالية للطالب الواحد ولسيمستر واحد من 12 حصة.

**EN heading:** Online prices, clear from the start.

**EN intro:** Choose a small group or one-to-one classes with the instructor. The prices below are per student for one 12-class semester.

| Element | AR — group | EN — group |
|---|---|---|
| Title | أونلاين جماعي | Online Group Classes |
| Price | 2,800 جنيه | EGP 2,800 |
| Unit | للطالب / للسيمستر | per student / per semester |
| Group | من 2 إلى 4 طلاب | 2–4 students |
| Schedule | 12 حصة خلال 3 شهور · حصة أسبوعيًا | 12 classes over 3 months · one class per week |
| Class length | ساعة ونصف للحصة | 90 minutes per class |
| Certificate | شهادة معتمدة من STEM بعد كل سيمستر | A STEM-accredited certificate after each semester |
| Action | استفسر عن الباقة الجماعية | Enquire About Group Classes |

| Element | AR — one-to-one | EN — one-to-one |
|---|---|---|
| Title | أونلاين فردي | Online One-to-One Classes |
| Price | 5,200 جنيه | EGP 5,200 |
| Unit | للطالب / للسيمستر | per student / per semester |
| Format | طالب واحد مع المدرب | One student with the instructor |
| Schedule | 12 حصة خلال 3 شهور · حصة أسبوعيًا | 12 classes over 3 months · one class per week |
| Class length | ساعة ونصف للحصة | 90 minutes per class |
| Certificate | شهادة معتمدة من STEM بعد كل سيمستر | A STEM-accredited certificate after each semester |
| Action | استفسر عن الباقة الفردية | Enquire About One-to-One Classes |

**AR mandatory note:** الأسعار بالجنيه المصري وتخص الدراسة الأونلاين فقط. السعر المعروض لسيمستر واحد من 12 حصة، وليس للمسار الكامل المكوّن من أربعة سيمسترات. لمعرفة تفاصيل الدراسة الحضورية، تواصل مع الأكاديمية.

**EN mandatory note:** Prices are in Egyptian pounds and apply to online classes only. Each price covers one 12-class semester, not the complete four-semester pathway. Contact the academy for in-person study details.

**AR no-payment helper:** للاستفسار وتحديد المجموعة أو الموعد المناسب، تواصل معنا. لا يتم تحصيل مدفوعات من خلال الموقع حاليًا.

**EN no-payment helper:** Contact us to discuss a suitable group or schedule. Payments are not collected through the website at this time.

Use working inquiry/contact destinations for the plan CTAs. Do not imply clicking one reserves a place, confirms a start date, or buys a course. An online-trial link is a separate secondary action, not a replacement label for a paid purchase.

## 5. Four pathway pages / محتوى صفحات المراحل

Proposed routes are public marketing routes, not LMS course IDs:

- `/programs/ages-6-8`
- `/programs/ages-9-11`
- `/programs/ages-12-14`
- `/programs/ages-15-17`

Shared page order: breadcrumb → age/title/intro → skills overview → four-semester HTML roadmap → study/progress → the same two price cards → FAQ → contextual online-trial CTA → footer.

Breadcrumb: الرئيسية ← المسارات التعليمية ← [المرحلة] / Home → Learning Pathways → [Pathway].

### 5.1 Ages6–8 / من6 إلى8 سنوات

**AR title:** رحلتهم الأولى في عالم البرمجة.

**EN title:** First Steps into Coding.

**AR homepage card:** بداية ممتعة في التفكير المنطقي والبرمجة البصرية. يتدرّج طفلك من ترتيب الأوامر إلى تحريك الشخصيات وبناء القصص والألعاب والعوالم ثلاثية الأبعاد.

**EN homepage card:** A playful introduction to logical thinking and visual coding. Your child progresses from arranging instructions to animating characters and creating stories, games and3D worlds.

**AR page introduction:** يبدأ الطفل بفهم ترتيب الأوامر وحل التحديات البسيطة، ثم يستخدم البرمجة البصرية لصناعة قصص تفاعلية وألعاب. يتدرّج المسار عبر أربعة سيمسترات وصولًا إلى تصميم عوالم وألعاب ثلاثية الأبعاد باستخدام Kodu.

**EN page introduction:** Children begin with ordered instructions and simple challenges, then use visual coding to create interactive stories and games. The four-semester pathway progresses towards designing3D worlds and games in Kodu.

**Skills / المهارات:** التفكير المنطقي / Logical thinking؛ ترتيب الأوامر / Sequencing؛ تحريك الشخصيات / Character animation؛ قواعد الألعاب / Game rules؛ تصميم العوالم / World design.

| Semester | AR title and description | EN title and description | Tools |
|---:|---|---|---|
| 1 | **أساسيات البرمجة:** ترتيب الأوامر والتفكير المنطقي من خلال أنشطة برمجة مناسبة للسن. | **Coding Foundations:** Practise sequencing and logical thinking through age-appropriate coding activities. | Code.org |
| 2 | **قصص تفاعلية:** تحريك الشخصيات وبناء المشاهد وربطها لصناعة قصة تفاعلية. | **Interactive Stories:** Animate characters, build scenes and connect them into an interactive story. | ScratchJr |
| 3 | **تصميم الألعاب:** بناء ألعاب متنوعة بقواعد وحركة باستخدام الأداة المناسبة لمستوى الطالب. | **Game Design:** Build games with movement and rules using a tool suited to the student's level. | ScratchJr or Scratch |
| 4 | **تصميم وبرمجة ألعاب3D:** إنشاء عوالم وألعاب ثلاثية الأبعاد من تصميم الطالب. | **3D Game Design and Coding:** Create student-designed3D worlds and games. | Kodu |

**Card action:** استكشف مسار6–8 سنوات / Explore Ages6–8.

**SEO title:** البرمجة للأطفال6–8 سنوات | Coding for Ages6–8. Use the existing site title template to append Robocode School once, not twice.

**AR meta description:** مسار برمجة أونلاين للأعمار6–8 سنوات باستخدام Code.org وScratchJr وScratch وKodu. اكتشف السيمسترات والأسعار ونظام الدراسة.

**EN meta description:** Explore live online coding for ages6–8 with Code.org, ScratchJr, Scratch and Kodu. View the semester roadmap, class format and prices.

### 5.2 Ages9–11 / من9 إلى11 سنة

**AR title:** من أساسيات الكود إلى تصميم التطبيقات.

**EN title:** From Coding Foundations to App Design.

**AR homepage card:** يتعلّم طفلك أساسيات البرمجة ويصمّم ألعابًا ثنائية الأبعاد، ثم يتعرّف على Python ويطوّر تطبيقات موبايل تفاعلية.

**EN homepage card:** Your child builds coding foundations and designs2D games, then explores Python and creates interactive mobile apps.

**AR page introduction:** يجمع هذا المسار بين التفكير المنطقي وصناعة الألعاب والتطبيقات. يبدأ الطالب بالتسلسل والتكرار والشروط، ثم ينتقل إلى تصميم الألعاب ومدخل مبسّط للبرمجة النصية باستخدام PictoBlox، وصولًا إلى تطبيقات الموبايل عبر MIT App Inventor.

**EN page introduction:** This pathway connects logical thinking with game and app creation. Students begin with sequences, loops and conditions, then explore game design and an introduction to text-based coding in PictoBlox before building mobile apps with MIT App Inventor.

**Skills / المهارات:** التسلسل والتكرار / Sequences and loops؛ الشروط وحل المشكلات / Conditions and problem-solving؛ تصميم الألعاب / Game design؛ مدخل للبرمجة النصية / Introduction to text-based coding؛ واجهات التطبيقات / App interfaces.

| Semester | AR title and description | EN title and description | Tools |
|---:|---|---|---|
| 1 | **أساسيات البرمجة:** التسلسل والتكرار والشروط وتطبيقها في حل التحديات. | **Coding Foundations:** Use sequences, loops and conditions to solve challenges. | Code.org |
| 2 | **ألعاب ثنائية الأبعاد:** تصميم ألعاب وإضافة النقاط والمراحل والتفاعل. | **2D Game Creation:** Design games with scoring, levels and interaction. | Scratch or mBlock |
| 3 | **مدخل إلى Python:** التعرّف على البرمجة النصية بمشروعات بسيطة باستخدام PictoBlox. | **Introduction to Python:** Explore text-based coding through simple projects in PictoBlox. | PictoBlox |
| 4 | **تطبيقات الموبايل:** تصميم واجهات وربطها بوظائف تفاعلية. | **Mobile App Design:** Create app interfaces and connect them to interactive functions. | MIT App Inventor |

**Card action:** استكشف مسار9–11 سنة / Explore Ages9–11.

**SEO title:** البرمجة والتطبيقات للأعمار9–11 | Coding and Apps for Ages9–11.

**AR meta description:** مسار أونلاين للأعمار9–11 من Code.org والألعاب إلى مدخل Python وتطبيقات MIT App Inventor. اطّلع على الرودماب والأسعار.

**EN meta description:** Explore online coding for ages9–11, from Code.org and games to introductory Python and MIT App Inventor. View the roadmap and prices.

### 5.3 Ages12–14 / من12 إلى14 سنة

**AR title:** من البرمجة إلى الذكاء الاصطناعي.

**EN title:** From Python to Artificial Intelligence.

**AR homepage card:** من أساسيات Python إلى فهم البيانات وتدريب نماذج بسيطة، ثم تطبيق الذكاء الاصطناعي في مشروعات عملية يضمّها الطالب إلى بورتفوليو أعماله.

**EN homepage card:** From Python foundations to understanding data and training simple models, students apply AI to practical projects for their digital portfolio.

**AR page introduction:** يتدرّج الطالب من المتغيرات والشروط والتكرار والدوال إلى فهم البيانات وتعلّم الآلة. بعد ذلك يطبّق نماذج ذكية على أفكار عملية، ويطوّر مشروعات متكاملة يعرضها ضمن بورتفوليو أعماله.

**EN page introduction:** Students progress from variables, conditions, loops and functions to data and machine learning. They then apply intelligent models to practical ideas and develop integrated projects to present in their portfolio.

**Skills / المهارات:** أساسيات Python / Python foundations؛ فهم البيانات / Understanding data؛ تعلّم الآلة / Machine learning؛ تطبيق نماذج ذكية / Applying AI models؛ تطوير المشروعات وعرضها / Developing and presenting projects.

| Semester | AR title and description | EN title and description | Tools/topics |
|---:|---|---|---|
| 1 | **أساسيات Python:** المتغيرات والشروط والتكرار والدوال. | **Python Foundations:** Work with variables, conditions, loops and functions. | Python |
| 2 | **الذكاء الاصطناعي وتعلّم الآلة:** فهم البيانات وكيفية تدريب نماذج بسيطة. | **AI and Machine Learning:** Understand data and how to train simple models. | AI, machine learning |
| 3 | **تطبيقات AI باستخدام Python:** تطبيق نماذج ذكية على أفكار عملية. | **AI Applications with Python:** Apply intelligent models to practical ideas. | Python, AI models |
| 4 | **مشروعات AI متكاملة:** تطوير المشروعات وعرضها ضمن بورتفوليو الطالب. | **Integrated AI Projects:** Develop projects and present them in the student's portfolio. | AI projects, portfolio |

**Card action:** استكشف مسار12–14 سنة / Explore Ages12–14.

**SEO title:** Python والذكاء الاصطناعي للأعمار12–14 | Python and AI for Ages12–14.

**AR meta description:** تعلّم Python والبيانات وتعلّم الآلة ضمن مسار أونلاين للأعمار12–14. اكتشف السيمسترات والمشروعات ونظام الدراسة والأسعار.

**EN meta description:** Explore Python, data and machine learning in an online pathway for ages12–14. View the semesters, project outcomes, class format and prices.

### 5.4 Ages15–17 / من15 إلى17 سنة

**AR title:** من البرمجة والذكاء الاصطناعي إلى المواقع والتطبيقات.

**EN title:** Coding and AI, Websites and Mobile Apps.

**AR homepage card:** يبدأ الطالب بـPython والذكاء الاصطناعي، ثم يبني صفحات ويب ويضيف إليها التفاعل، ويتعلّم أساسيات تطبيقات الموبايل باستخدام Flutter وDart.

**EN homepage card:** Students begin with Python and AI, build web pages and add interaction, then explore mobile app development with Flutter and Dart.

**AR page introduction:** مسار يربط البرمجة بتطبيقاتها العملية في الذكاء الاصطناعي والويب والموبايل. يبدأ بـPython وGoogle Colab، ثم ينتقل إلى HTML وCSS وJavaScript، وينتهي بأساسيات بناء تطبيقات متعددة الشاشات باستخدام Flutter وDart.

**EN page introduction:** A pathway connecting coding with practical AI, web and mobile development. Students start with Python and Google Colab, progress through HTML, CSS and JavaScript, and finish with the foundations of multi-screen apps using Flutter and Dart.

**Skills / المهارات:** Python وتجارب AI / Python and AI experiments؛ صفحات ويب مناسبة للموبايل / Responsive web pages؛ تفاعل JavaScript / JavaScript interaction؛ تطبيقات متعددة الشاشات / Multi-screen apps.

| Semester | AR title and description | EN title and description | Tools |
|---:|---|---|---|
| 1 | **أساسيات Python والذكاء الاصطناعي:** أساسيات البرمجة وتجارب على البيانات ونماذج AI. | **Python and AI Foundations:** Learn programming foundations and experiment with data and AI models. | Python, Google Colab |
| 2 | **تصميم الويب1:** بناء مواقع وصفحات مناسبة للموبايل والكمبيوتر. | **Web Design1:** Build websites and pages for mobile and desktop screens. | HTML, CSS, VS Code |
| 3 | **تصميم الويب2:** إضافة التفاعل وبناء مواقع وتطبيقات ويب بسيطة. | **Web Design2:** Add interaction and build simple websites and web apps. | JavaScript, VS Code |
| 4 | **أساسيات تطبيقات الموبايل:** تصميم تطبيقات متعددة الشاشات مع التنقل والتفاعل. | **Mobile App Foundations:** Design multi-screen apps with navigation and interaction. | Flutter, Dart, VS Code |

**Card action:** استكشف مسار15–17 سنة / Explore Ages15–17.

**SEO title:** البرمجة والويب والتطبيقات للأعمار15–17 | Coding, Web and Apps for Ages15–17.

**AR meta description:** مسار أونلاين للأعمار15–17 يشمل Python وAI وHTML وCSS وJavaScript وFlutter وDart. اطّلع على السيمسترات والأسعار.

**EN meta description:** Explore online Python, AI, web and mobile app learning for ages15–17 with HTML, CSS, JavaScript, Flutter and Dart. View semesters and prices.

## 6. Shared pathway notes & CTA / الملاحظات والأزرار

**Roadmap note AR:** توضح الرودماب تسلسل التعلّم داخل المرحلة. قد تختلف وتيرة التقدّم حسب مستوى الطالب وتطوّره.

**Roadmap note EN:** The roadmap shows the learning sequence within the pathway. Progress may vary with the student's level and development.

**Semester label:** السيمستر1 / Semester1 (use1–4 consistently; do not mix level/course/semester as synonyms).

**AR final CTA title:** ابدأ بالمسار المناسب لطفلك.

**AR final CTA body:** احجز تجربة أونلاين وتواصل مع فريق الأكاديمية لمعرفة البداية المناسبة حسب العمر والمستوى.

**EN final CTA title:** Find the right starting point for your child.

**EN final CTA body:** Book an online trial and speak with the academy team about a suitable starting point for your child's age and level.

**Button:** احجز تجربة أونلاين / Book an Online Trial.

The current website offers a free trial, but no new guarantee of a full90-minute free lesson, refund window, assessment procedure, or response SLA is introduced here. Do not imply a trial is paid enrollment.

## 7. FAQ copy / الأسئلة الشائعة

| AR question and answer | EN question and answer |
|---|---|
| **ما الأعمار المناسبة؟** تعرض مسارات الأونلاين أربع مراحل:6–8،9–11،12–14،15–17 سنة. تواصل معنا لمعرفة البداية المناسبة حسب العمر والمستوى. | **Which ages are the pathways for?** Our online pathways cover ages6–8,9–11,12–14 and15–17. Contact us to discuss a suitable starting point for your child's age and level. |
| **ما مدة السيمستر؟**12 حصة خلال3 شهور، بمعدل حصة أسبوعيًا. مدة الحصة ساعة ونصف. | **How long is a semester?**12 classes over3 months, with one90-minute class per week. |
| **هل السعر للمسار الكامل؟** لا.2,800 جنيه للجماعي و5,200 جنيه للفردي هما سعر الطالب لسيمستر واحد من12 حصة، وليس للسيمسترات الأربعة. | **Does the price cover the complete pathway?** No. EGP2,800 for group classes and EGP5,200 for one-to-one classes cover one student for one12-class semester, not all four semesters. |
| **كم طالبًا في المجموعة؟** من2 إلى4 طلاب في الأونلاين الجماعي. الأونلاين الفردي لطالب واحد مع المدرب. | **How many students are in a class?** Online groups have2–4 students. One-to-one classes are for one student with the instructor. |
| **هل الأسعار تشمل الدراسة الحضورية؟** الأسعار المعروضة للأونلاين فقط. تواصل مع الأكاديمية لمعرفة تفاصيل الدراسة في الفروع. | **Do these prices apply to in-person classes?** The displayed prices are for online classes only. Contact the academy for in-person study details. |
| **هل يحصل الطالب على شهادة؟** يحصل الطالب على شهادة معتمدة من STEM بعد كل سيمستر. | **Will my child receive a certificate?** Students receive a STEM-accredited certificate after each semester. |
| **كيف أتابع تقدّم طفلي؟** عبر منصة LMS وبورتفوليو رقمي لمشروعات الطالب. | **How can I follow my child's progress?** Through the LMS and a digital portfolio of the student's projects. |
| **هل يمكن الدفع من الموقع؟** لا يتم تحصيل مدفوعات من الموقع حاليًا. يمكنك الاستفسار عن الباقة أو حجز تجربة أونلاين والتواصل مع الأكاديمية. | **Can I pay through the website?** Payments are not collected through the website at this time. You can enquire about a plan, book an online trial and contact the academy. |

Do not publish new promises about software compatibility, paid licenses, hardware included, guaranteed outcomes or cancellation rules in the FAQ without confirmation. Existing terms/refund/privacy pages remain the source for their respective policies.

## 8. Conflicts and decisions / التعارضات والقرارات

| Source conflict | Approved resolution | Publication rule |
|---|---|---|
| All four posters say3–5 students | Owner's newer instruction:2–4 | Correct visible poster text before using full posters online. |
| All posters say90–120 minutes | Owner confirms90 minutes | No120-minute claim in copy or visible image. |
| Posters say4 classes monthly | Owner confirms weekly,12 over3 months | Prefer weekly wording; do not guarantee exactly four in every calendar month. |
| Old hero6–18; audited remote stages5–8 /15–17; fallback15–18; form4–18 | New public pathways6–17 in four approved ranges | Align public copy, fallbacks, validation and any published remote values during UI work. Do not alter LMS eligibility or historical records. |
| Legacy topic cards advertise subjects beyond these posters | Four approved online age pathways | No Minecraft/Roblox/React/VR/Arduino sales promise in these pathway cards. Existing in-person/LMS subjects are not deleted. |
| Old roadmap says hardware/autonomous robots or production-grade AI/startup pipelines | Poster-based introductory learning outcomes | Avoid promising professional mastery or a different curriculum. |
| Images depict four semesters while price is for12 classes | Price is for one semester only | Repeat the price-unit note on homepage and all detail pages. Do not display a single semester price beside the whole roadmap without explanation. |
| Posters mix promotional graphics, logos and curriculum text | HTML copy is the primary readable content | Corrected poster may be supplementary/zoomable. Do not shrink a full poster into the main mobile curriculum. |
| Each poster includes STEM branding | Owner confirms certificate wording | Use the approved certificate statement, not wider unverified accreditation claims. |
| Marketing content can be disabled/overridden by CMS | Explicit content ownership and publishing checks | Do not force all disabled sections visible or let old single-language API data overwrite approved facts. |

Retain the originals unchanged. Corrected graphics must be new derivatives, created in a later authorized image task; no image edits made here. For thumbnails, use an appropriate visual with text supplied in HTML; do not accidentally leave contradictory poster text legible in a crop.

## 9. Implementation sequence / خطة التنفيذ

### Task1 — this document

- Read source, previous audit, approved posters and owner decisions.
- Deliver bilingual copy, source/conflict inventory, route proposal and sequencing.
- Review checkpoint before coding. Only this planning document is added.

### Task2 — homepage pathways and pricing

- Add one marketing-only bilingual catalog and shared price/schedule constants, proposed location `lib/public-site/online-programs.ts` (not created now).
- Replace old public topic cards with four approved pathway cards; add `OnlinePricingSection` with the two plans on the homepage.
- Reconcile `HomeSections` and publishing order/visibility. The required prices and pathways must not disappear due to legacy settings, but unrelated intentionally hidden sections must stay hidden.
- Use the same facts in cards, summaries, FAQ and later detail pages. Keep duplicate facts out of CMS/fallback paths or define their explicit precedence.
- If detail pages are not shipped in the same release, do not activate unbuilt detail routes. Local preview only until the connected journey passes checks.

### Task3 — four public detail pages

- Proposed route: `app/programs/[slug]/page.tsx`, allowlisted to the four slugs; unknown slugs404.
- Shared page composition and localized content, readable HTML semester roadmap, corrected optional images, shared pricing, policy links and contextual CTA.
- Preserve chosen pathway and optional inquiry plan in the public booking journey. Proposed parameters: `pathway=ages-6-8` and `plan=group` or `one-to-one`; validate values against the catalog, do not treat a query string as an authoritative payment price or LMS contract ID.
- Initial copy may be a typed public-only catalog; adding multilingual CMS editing is a separate scope, not an implied migration of LMS courses.

### Task4 — public navigation/localization and critical UX

- Header/footer valid destinations; no silent dead-end links.
- Mobile menu scroll/Escape/focus, tablet breakpoint, numerical direction and complete public AR/EN translation.
- Correct relevant color contrast and fix late locale/layout shift without unreviewed global portal changes.
- Reconcile metadata domain/title duplication in an isolated, regression-tested change.

### Task5 — booking/contact/policies

- Carry validated pathway/plan context through the form and staff-facing lead details only after reviewing the current booking API shape.
- No payment, automatic paid enrollment, contract creation or collection on form submission.
- Correct international WhatsApp formats and maps; verify the intended main contact number before replacing the placeholder-looking destination.
- Add policy links adjacent to the form. Commercial/legal text changes require separate approval.

### Task6 onward — readiness, polish, final QA and release

- Review public services/prices/contact/policy coverage; do not guarantee gateway approval.
- Complete remaining public design/accessibility/performance work from the audit, then repeat the full public test matrix.
- Local preview → review → approved commit/deployment task. No commit/push/deploy in this task.

## 10. Future acceptance criteria / معايير القبول لاحقًا

1. The homepage shows exactly four approved age pathways and both online plans in AR and EN.
2. Every plan says per student/per semester,12 classes,3 months, weekly,90 minutes; group count2–4 is consistent.
3. The difference between one semester and the four-semester pathway is visible beside prices on all five marketing pages.
4. Each path has exactly four ordered semester entries matching the supplied curriculum, with equivalent AR/EN meaning.
5. No legacy remote/fallback text can silently restore15–18,3–5 students,120 minutes, or the old topic catalog within the new online offer.
6. No dead details links, hidden anchor destinations, Buy Now button, payment form or checkout is published.
7. Unknown pathway/plan values are safely rejected or ignored; unknown page slugs return404.
8. Published images contain no contradictions; HTML is sufficient to read the curriculum without opening an image.
9. Existing portal routes, LMS course records, enrollments, contracts, attendance and payments are unchanged.
10. Checks at320/390/768/1024/1440 in AR and EN include keyboard/focus, text contrast, mobile menu, roadmap readability and locale reload.
11. Performance is measured before claims are made; verify no repeat of the documented Arabic layout shift.
12. No production lead or message is sent during QA; any successful form submission uses a controlled test environment.

## 11. Localization and editorial rules

- Keep Robocode School as the brand in both languages; use الأكاديمية for the organization, not المدرسة.
- Use مسار تعليمي / Learning Pathway for the age group and سيمستر / Semester for each12-class unit. Course is not a substitute for the full four-semester pathway when describing price.
- Keep tool names unchanged: Code.org, ScratchJr, Scratch, mBlock, PictoBlox, Kodu, MIT App Inventor, Python, Google Colab, HTML, CSS, JavaScript, VS Code, Flutter, Dart.
- In Arabic, isolate age ranges, prices, email/URLs and mixed Latin labels with appropriate directional markup. Do not reverse the numeric order.
- Use space-aware rendering for Arabic/English text; editorial compact numeric notation in this document is not a typography specification.
- No best-value, most-popular, was-price, countdown, seat scarcity, guaranteed result or employment claim without evidence/approval.
- Enquiry means contact, trial means trial, and payment means payment; labels must match the implemented outcome.

## 12. Remaining confirmations — not blockers for drafting

- Whether prices include applicable taxes or any additional charges has not been stated. Do not invent either inclusions or extra fees. Resolve the final price disclosure before publishing.
- Software/device requirements, trial duration and response-time promises are not newly approved here; retain no new claims about them until confirmed.
- The inquiry destination and official main WhatsApp number need confirmation before contact-link changes. This does not block pathway copy or local UI previews.

This plan does not require selecting a payment provider. Pricing publication and a later payment integration remain separate tasks.
