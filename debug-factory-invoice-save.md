[OPEN]

# Debug Session: factory-invoice-save

## Symptom
- إنشاء `Créer une Facture (Groupement BL)` يفشل.
- الرسالة الحالية من الواجهة: `null value in column "supplierId" of relation "factory_invoices" violates not-null constraint`.
- الـ payload الظاهر للمستخدم يحتوي `supplierId` بقيمة غير فارغة.

## Expected
- تُحفَظ الفاتورة في `Supabase`.
- لا تختفي بعد `actualiser`.
- عند الدفع من البنك يتم خصم `total facture` من حساب المورد البنكي.

## Hypotheses
1. دالة `toWritePayload()` تُسقط `supplierId` قبل الإرسال بسبب تعارض بين `columnMap` و`tableColumnHints`.
2. `supabaseService.create()` يحاول إعادة تشكيل الـ payload عدة مرات ويزيل `supplierId` بعد خطأ أعمدة مفقودة.
3. جدول `factory_invoices` في `Supabase` لا يطابق الأعمدة التي يفترضها الكود، خصوصاً بين `camelCase` و`snake_case`.
4. منطق إنشاء الفاتورة في `Factory.tsx` يمرر كائناً صحيحاً للواجهة لكن غير متوافق مع طبقة الحفظ.
5. فشل الحفظ يمنع أيضاً تسجيل حركة الخصم البنكي، لذلك عرض البنك لا يتغير.

## Current Evidence
- Evidence E1: رسالة الخطأ تشير إلى `supplierId` نفسه، لا إلى `supplier_id`.
- Evidence E2: الـ payload المعروض في الـ alert يحتوي `supplierId` بقيمة نصية.
- Evidence E3: الكود في `Factory.tsx` يبني `newInvoice.supplierId` بشكل صحيح قبل الاستدعاء.
- Evidence E4: `supabaseService.ts` كان يعتمد على mapping ثابت لـ `factory_invoices` رغم أن بنية الجدول في `Supabase` عند المستخدم تبدو مختلفة عن الافتراض.

## Next Step
- تمّت إضافة instrumentation في `supabaseService.create()` لتخزين:
  - `nextItem`
  - `initialPayload`
  - محاولات الإدخال والأخطاء
- تم تطبيق إصلاح أولي:
  - إعادة default mapping إلى `snake_case`
  - جعل `resolveColumnName()` يفضّل الأعمدة المكتشفة فعلياً من القاعدة
  - جعل `toWritePayload()` في `factory_invoices` يرسل عدة صيغ مرشحة (`supplierId` / `supplier_id` / `supplierid`) عند غياب hints، ثم يزيل غير الموجود تلقائياً حسب رسالة Supabase

## Verification Pending
- مطلوب من المستخدم عمل `Actualiser` كامل ثم إعادة المحاولة لتأكيد أن الإدخال صار يمر وأن خصم البنك يعمل بعد نجاح إنشاء الفاتورة.
