# إعداد بيئة التطوير

يُنفّذ Claude Code هذه الخطوات تلقائيًا في أول جلسة (انظر `CLAUDE.md`)، ويعلّمها هنا عند انتهائها.

- [x] التأكّد من وجود Node.js بإصدار 22.12 أو أحدث
- [x] `npm ci`
- [x] `npm run setup` (المهارات الـ17 في `.claude/skills`، وCI في `.github`، وإعدادات `.vscode`)
  - ملاحظة: لوحة `/skills` في تطبيق Claude لسطح المكتب تعرض مهارات حساب claude.ai فقط (docs, pdf, xlsx…). مهارات المشروع الـ17 لا تظهر فيها، لكنها محمَّلة: اكتب `/` ثم اسم المهارة (مثل `/mvp-scope` أو `/roles-permissions`) أو دع Claude يستدعيها تلقائيًا حسب المهمة.
- [x] `npm run check` (الفحص الكامل والاختبارات)
- [x] مستودع Git: https://github.com/ahmedTensei/LisanHub — الاستيراد الأوّلي في 18 سبتمبر 2026 (201 ملفًا، ترخيص PolyForm Noncommercial 1.0.0). بعده: لا إيداع ولا رفع إلا بطلب صريح من أحمد.
- [x] تشغيل `npm run dev` وفتح http://localhost:3000
- [x] (S1) `npm run db:verify` — 42 فحصًا تثبت الربط الفعلي بالمشروع المستضاف (شغّله بعد كل `db:push`)
- [x] (S1) مشروع Supabase مستضاف: `.env.local` مكتوب، `npx supabase login` و`link` نفّذهما أحمد، الترحيلات والإعدادات مدفوعة، الأنواع مولَّدة

## ما احتاجه أحمد وحده في S1 (منجز)

إنشاء حساب Supabase لا يمكن أن يتمّ نيابةً عنك. اختار أحمد المشروع المستضاف (باريس) في 17 سبتمبر 2026. الخياران كانا:

1. **مشروع مستضاف**: تنشئ مشروعًا في لوحة Supabase، ثم يضع Claude Code القيم في `.env.local` ويطبّق الترحيلات.
2. **تشغيل محلي**: يتطلّب Docker Desktop، ثم `npm run db:start` و`npm run db:reset` (يُنزَّل Supabase CLI تلقائيًا عبر npx).

الاختبارات تعمل دون اتصال (PGlite)، والتطبيق يقرأ `.env.local`. لمنح نفسك رتبة إدارية: لوحة Supabase → SQL Editor → `insert into public.admin_ranks (user_id, rank) values ('<uuid من auth.users>', 'platform_owner');`

## قبل الإطلاق على نطاق حقيقي (أو عدّة نطاقات)

روابط الملفات العامة والبريد لا تحتوي على `localhost` مكتوبًا في أي مكان؛ كلها تُشتقّ من النطاق الذي يخدم الصفحة:

- رابط الملف العام (`/u/<username>`) يُبنى في المتصفح من `window.location.origin` → يتبع أي نطاق تلقائيًا.
- روابط تأكيد البريد واستعادة كلمة المرور تُبنى في الخادم من ترويسة `Origin`/`Host` للطلب (`src/server/site-url.ts`)، ويمكن تثبيتها بمتغيّر البيئة `SITE_URL` على الاستضافة.
- روابط الصور تأتي من Supabase Storage وهي مستقلة عن نطاق الموقع.

ما يلزم يدويًا عند تغيير النطاق (مرة واحدة لكل نطاق):

1. في `supabase/config.toml`: `site_url = "https://<النطاق>"` وأضف `"https://<النطاق>/**"` إلى `additional_redirect_urls` (عدّة نطاقات = عدّة عناصر في القائمة، مع الإبقاء على localhost للتطوير).
2. `npm run db:config:push` ثم `npm run db:verify`.
3. على الاستضافة: `NEXT_PUBLIC_SUPABASE_URL` و`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` و(اختياريًا) `SITE_URL`.
