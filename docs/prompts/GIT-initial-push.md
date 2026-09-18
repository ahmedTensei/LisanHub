# أمر لمرّة واحدة — تنظيف المستودع ورفع المشروع وضبط إعداداته

> طريقة الاستخدام: في Claude Code (بدون وضع التخطيط) اكتب سطرًا واحدًا:
> «نفّذ التعليمات في docs/prompts/GIT-initial-push.md»
>
> نفّذ كل ما هنا بنفسك دون أن تطلب من أحمد أي خطوة، إلا تسجيل الدخول إلى GitHub إن طُلب.

المستودع: **https://github.com/ahmedTensei/LisanHub** (عام). فيه الآن ثلاثة إيداعات لهيكل أوّلي بترخيص Apache-2.0، و**كلها تُستبدل** بقرار أحمد اليوم (18 سبتمبر 2026).

## القرارات التي تنفّذها هذه المهمة

1. **الترخيص: PolyForm Noncommercial 1.0.0** — الاستعمال غير التجاري مسموح، والتجاري ممنوع دون إذن مكتوب. ملف `LICENSE` و`NOTICE` جاهزان في المشروع. **لا تستبدلهما ولا تضف ترخيصًا آخر.** Apache-2.0 السابق يختفي.
2. **تاريخ نظيف**: يُستبدل محتوى الفرع `main` بالكامل بتاريخ جديد. هذه **المرّة الوحيدة** المسموح فيها بـ `--force`، بقرار صريح من أحمد.
3. **المساهمات الخارجية مغلقة الآن**: `CONTRIBUTING.md` و`SECURITY.md` يوضّحان ذلك.
4. **لا يُنشر**: `docs/specification/` (المواصفات ونموذج العمل)، أي `.env*` عدا `.env.example`، `supabase/.temp`، و`.claude/`.

## 1. قبل أي شيء

1. `npm run check` — لا تُودِع شجرة فاشلة. إن فشل شيء أصلحه أولًا.
2. تأكّد أن `.git` غير موجود في المشروع. إن وُجد، توقّف واسأل أحمد.
3. تأكّد أن هذه الملفات موجودة ومحدَّثة: `LICENSE`، `NOTICE`، `README.md`، `CONTRIBUTING.md`، `SECURITY.md`، `docs/quickstart-ar.md`.
4. تحقّق من `.gitignore`: `.env*` مع `!.env.example`، و`/.claude/`، و`/docs/specification/`، و`supabase/.temp`، و`node_modules`، و`.next`.

## 2. الفحص الأمني — يفشل مغلقًا

```
git init -b main
git add -A
```

ثم نفّذ الفحصين التاليين، وكلاهما **يجب أن يعود فارغًا**:

```
git ls-files --cached | Select-String -Pattern "^\.env(?!\.example)|supabase/\.temp|docs/specification/|^\.claude/"
git grep -I --cached -nE "service_role|sb_secret_|SUPABASE_SERVICE|BEGIN [A-Z ]*PRIVATE KEY"
```

إن ظهر أي شيء: **توقّف فورًا**، لا تُودِع، وأخبر أحمد بالملف والسبب.

## 3. الإيداع الأوّل

إيداع واحد يضمّ المشروع الحالي كاملًا (S0 وS1 والمهارات والوثائق والترخيص)، برسالة إنجليزية واضحة.

## 4. أرشفة المحتوى القديم قبل مسحه

```
git remote add origin https://github.com/ahmedTensei/LisanHub.git
git fetch origin main
git branch archive/old-remote origin/main
```

هذا الفرع **محلّي فقط ولا يُرفع**؛ يبقى كنسخة من الإيداعات الثلاثة القديمة إن احتاجها أحمد يومًا.

## 5. الرفع مع استبدال التاريخ

```
git push --force -u origin main
```

إن طُلبت المصادقة: **لا تطلب من أحمد رمزًا ولا كلمة مرور في المحادثة، ولا تكتب أي رمز في ملف.** قل له أن يُكمل تسجيل الدخول في نافذة المتصفّح التي يفتحها Git Credential Manager، أو أن ينفّذ `gh auth login` بنفسه، ثم أعد المحاولة.

## 6. التحقّق من المرفوع

```
gh api "repos/ahmedTensei/LisanHub/git/trees/main?recursive=1" --jq ".tree[].path"
```

تأكّد أن القائمة **لا تحتوي**: أي ملف `.env` (عدا `.env.example`)، ولا `docs/specification/`، ولا `supabase/.temp/`، ولا `.claude/`. وتأكّد أن `LICENSE` الجديد موجود وأن ملفات المستودع القديمة (`map/` وما كان في `docs/` سابقًا) لم تعد موجودة.

> ملاحظة متوقَّعة: GitHub قد لا يتعرّف على PolyForm فيكتب «License not recognized» بدل اسم الترخيص. هذا طبيعي ولا يعني خللًا.

## 7. إعدادات المستودع (بـ `gh`)

نفّذها واحدة واحدة، وتجاوز ما يفشل مع ذكره في التقرير النهائي:

```
gh repo edit ahmedTensei/LisanHub --description "Community-driven language-learning platform. Source-available, noncommercial licence. Early development." --enable-wiki=false --enable-projects=false --enable-issues=true --enable-discussions=false
gh repo edit ahmedTensei/LisanHub --add-topic language-learning --add-topic nextjs --add-topic supabase --add-topic typescript --add-topic rtl --add-topic arabic --add-topic plugins --add-topic source-available
gh api -X PATCH repos/ahmedTensei/LisanHub -f "security_and_analysis[secret_scanning][status]=enabled" -f "security_and_analysis[secret_scanning_push_protection][status]=enabled"
gh api -X PUT repos/ahmedTensei/LisanHub/vulnerability-alerts
gh api -X PUT repos/ahmedTensei/LisanHub/automated-security-fixes
```

**فحص الأسرار مع الحماية عند الدفع أهمّها**: يمنع رفع مفتاح بالخطأ إلى مستودع عام، وهو مجاني للمستودعات العامة.

ثم حماية الفرع `main` — تمنع مسح الفرع وإعادة كتابة تاريخه، وتُبقي الدفع المباشر ممكنًا لأحمد وحده:

```
gh api -X PUT repos/ahmedTensei/LisanHub/branches/main/protection -H "Accept: application/vnd.github+json" -F "required_status_checks=null" -F "enforce_admins=false" -F "required_pull_request_reviews=null" -F "restrictions=null" -F "allow_force_pushes=false" -F "allow_deletions=false"
```

إن فشل هذا الأمر فتجاوزه واذكره؛ الباقي أهمّ منه.

## 8. بعد نجاح الرفع والتحقّق فقط

1. احذف النسخة الاحتياطية المحلية بطلب أحمد:
   ```
   Remove-Item -Recurse -Force "C:\Users\GEAR\Documents\LisanHub-backups"
   ```
   ثم تأكّد أن المجلّد لم يعد موجودًا. **لا تحذفه قبل التحقّق من الرفع.**
2. علّم بند Git في `docs/SETUP.md` كمنجز مع رابط المستودع، وحدّث «Current state» في `CLAUDE.md` بأن المستودع صار حيًّا.
3. لخّص لأحمد بالعربية: عدد الملفات المرفوعة، ما استُثني، الإعدادات التي طُبّقت وما فشل منها، ورابط المستودع.

## القاعدة الدائمة بعد هذه المهمة

**لا إيداع ولا رفع ولا فرع ولا وسم ولا `--force` إلا بطلب صريح من أحمد في رسالته.** أنهِ عملك واترك الشجرة غير مودعة، وقل له: «جاهز للإيداع متى أردت».
