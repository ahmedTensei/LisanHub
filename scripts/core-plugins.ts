/**
 * The two core plugins of phase A, expressed exactly as the studio stores a
 * draft (decision R7, ADR 0006 §12): a field structure picked from the
 * catalogue, a graded field, a reference evaluator, and templates that carry
 * hints only. The definitions are produced by the studio's own pipeline
 * (`definitionFromDraft`), exported to plugins/core/ and seeded from there as
 * reference data — a plugin is software, not content (decision R8).
 *
 * Rebuilding either one by hand in the studio with the same choices gives the
 * same sha256; that is the check the seeding migration test enforces.
 *
 * Run through scripts/build-core-plugins.mjs.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { PluginDraft } from "@/modules/plugins/contract";
import { definitionFromDraft } from "@/modules/plugins/generate";
import { definitionSha256, exportDefinition } from "@/modules/plugins/portable";

const t = (ar: string, fr: string, en: string) => ({ ar, fr, en });

const prompt = (
  hint = t(
    "السؤال أو التعليمة كما يراها المتعلّم.",
    "La question ou la consigne telle que l’apprenant la voit.",
    "The question or instruction as the learner sees it.",
  ),
) => ({
  key: "prompt",
  type: "short_text" as const,
  label: t("السؤال", "Question", "Prompt"),
  hint,
  required: true,
  max_length: 300,
});

const picture = {
  key: "picture",
  type: "image" as const,
  label: t("صورة", "Image", "Picture"),
  hint: t(
    "اختياري. صورة توضّح السؤال، مع نصّ بديل يصفها.",
    "Facultatif. Une image qui illustre la question, avec un texte alternatif.",
    "Optional. A picture illustrating the prompt, with alternative text.",
  ),
  required: false,
};

const classicExercises: PluginDraft = {
  format: "lisanhub.plugin/1",
  plugin_id: "classic-exercises",
  version: "1.0.0",
  schema_version: 1,
  name: t("التمارين الكلاسيكية", "Exercices classiques", "Classic exercises"),
  description: t(
    "أربعة أنواع من التمارين: اختيار من متعدّد، إكمال فراغ، مطابقة، وترتيب كلمات. يُقيَّم كل تمرين بمقيّمات المنصّة المرجعية.",
    "Quatre types d’exercices : choix multiple, texte à trous, appariement et ordre des mots. Chaque exercice est noté par les évaluateurs de référence de la plateforme.",
    "Four exercise types: multiple choice, fill in the blank, matching and word order. Each is scored by the platform’s reference evaluators.",
  ),
  activities: [
    {
      id: "multiple-choice",
      name: t("اختيار من متعدّد", "Choix multiple", "Multiple choice"),
      description: t(
        "سؤال بخيارات، واحد منها صحيح.",
        "Une question à options, dont une seule est correcte.",
        "A question with options, one of them correct.",
      ),
      skill: "reading",
      fields: [
        prompt(),
        picture,
        {
          key: "options",
          type: "single_choice",
          label: t("الخيارات", "Options", "Options"),
          hint: t(
            "من خيارين إلى ستة، وعلّم الصحيح.",
            "De deux à six options ; marquez la bonne.",
            "Two to six options; mark the correct one.",
          ),
          required: true,
          min_options: 2,
          max_options: 6,
        },
      ],
      graded_field: "options",
      scoring: { evaluator: "multiple_choice" },
    },
    {
      id: "fill-blank",
      name: t("إكمال فراغ", "Texte à trous", "Fill in the blank"),
      description: t(
        "نصّ فيه فراغات يكتب المتعلّم ما يملؤها؛ التشكيل العربي لا يُحتسب.",
        "Un texte à trous que l’apprenant complète ; les diacritiques arabes sont ignorés.",
        "A text with gaps the learner fills in; Arabic diacritics are ignored.",
      ),
      skill: "writing",
      fields: [
        prompt(
          t(
            "تعليمة قصيرة، مثل: أكمل الجملة.",
            "Une consigne courte, par exemple : complétez la phrase.",
            "A short instruction, such as: complete the sentence.",
          ),
        ),
        picture,
        {
          key: "gap",
          type: "blank_in_text",
          label: t("النصّ بفراغاته", "Texte et trous", "Text with gaps"),
          hint: t(
            "ضع {{0}} و{{1}}… مكان الفراغات، ثم اكتب الأجوبة المقبولة لكل فراغ.",
            "Placez {{0}}, {{1}}… à l’emplacement des trous, puis les réponses acceptées pour chacun.",
            "Put {{0}}, {{1}}… where the gaps go, then the accepted answers for each.",
          ),
          required: true,
          max_blanks: 5,
        },
      ],
      graded_field: "gap",
      scoring: { evaluator: "fill_blank", ignore_case: true, ignore_arabic_diacritics: true },
    },
    {
      id: "matching",
      name: t("مطابقة", "Appariement", "Matching"),
      description: t(
        "أزواج يطابق المتعلّم طرفيها.",
        "Des paires dont l’apprenant relie les deux côtés.",
        "Pairs whose two sides the learner matches.",
      ),
      skill: "reading",
      fields: [
        prompt(
          t(
            "تعليمة قصيرة، مثل: طابق كل كلمة بمعناها.",
            "Une consigne courte, par exemple : associez chaque mot à son sens.",
            "A short instruction, such as: match each word with its meaning.",
          ),
        ),
        picture,
        {
          key: "pairs",
          type: "matching_pairs",
          label: t("الأزواج", "Paires", "Pairs"),
          hint: t("من زوجين إلى عشرة.", "De deux à dix paires.", "Two to ten pairs."),
          required: true,
          min_pairs: 2,
          max_pairs: 10,
        },
      ],
      graded_field: "pairs",
      scoring: { evaluator: "matching" },
    },
    {
      id: "word-order",
      name: t("ترتيب كلمات", "Ordre des mots", "Word order"),
      description: t(
        "كلمات مبعثرة يعيد المتعلّم ترتيبها.",
        "Des mots mélangés que l’apprenant remet dans l’ordre.",
        "Shuffled words the learner puts back in order.",
      ),
      skill: "writing",
      fields: [
        prompt(
          t(
            "تعليمة قصيرة، مثل: رتّب الكلمات لتكوين جملة.",
            "Une consigne courte, par exemple : remettez les mots dans l’ordre.",
            "A short instruction, such as: put the words in order.",
          ),
        ),
        picture,
        {
          key: "words",
          type: "ordering",
          label: t("الكلمات بترتيبها الصحيح", "Mots dans le bon ordre", "Words in the correct order"),
          hint: t(
            "اكتبها بالترتيب الصحيح؛ المشغّل يخلطها للمتعلّم.",
            "Écrivez-les dans le bon ordre ; le lecteur les mélange pour l’apprenant.",
            "Write them in the correct order; the player shuffles them for the learner.",
          ),
          required: true,
          min_tokens: 2,
          max_tokens: 20,
        },
      ],
      graded_field: "words",
      scoring: { evaluator: "word_order" },
    },
  ],
  templates: [
    {
      id: "lesson-starter",
      name: t("درس تمارين", "Leçon d’exercices", "Exercise lesson"),
      description: t(
        "تمرين واحد من كل نوع لتبدأ منه؛ احذف ما لا تحتاجه وأضف ما تريد.",
        "Un exercice de chaque type pour commencer ; supprimez ce dont vous n’avez pas besoin et ajoutez le reste.",
        "One exercise of each type to start from; remove what you do not need and add more.",
      ),
      items: [
        { activity: "multiple-choice", hints: {} },
        { activity: "fill-blank", hints: {} },
        { activity: "matching", hints: {} },
        { activity: "word-order", hints: {} },
      ],
    },
  ],
  custom_schema: false,
  assets_allowed: ["image"],
  capabilities_required: [],
};

const vocabCards: PluginDraft = {
  format: "lisanhub.plugin/1",
  plugin_id: "vocab-cards",
  version: "1.0.0",
  schema_version: 1,
  name: t("بطاقات المفردات", "Cartes de vocabulaire", "Vocabulary cards"),
  description: t(
    "بطاقة بوجه وظهر ومثال اختياري وصورة اختيارية ووسوم. يكشف المتعلّم الظهر ثم يقيّم نفسه، فتُجدول المراجعة على ذلك.",
    "Une carte avec un recto, un verso, un exemple facultatif, une image facultative et des étiquettes. L’apprenant révèle le verso puis s’auto-évalue, ce qui alimente la révision espacée.",
    "A card with a front, a back, an optional example, an optional picture and tags. The learner reveals the back and rates their own recall, which drives spaced review.",
  ),
  activities: [
    {
      id: "card",
      name: t("بطاقة", "Carte", "Card"),
      description: t(
        "وجه يُعرض أولًا، وظهر يُكشف عند الطلب.",
        "Un recto affiché d’abord, un verso révélé à la demande.",
        "A front shown first, a back revealed on request.",
      ),
      skill: "reading",
      fields: [
        {
          key: "front",
          type: "short_text",
          label: t("الوجه", "Recto", "Front"),
          hint: t(
            "الكلمة أو العبارة التي يراها المتعلّم أولًا.",
            "Le mot ou l’expression que l’apprenant voit en premier.",
            "The word or phrase the learner sees first.",
          ),
          required: true,
          max_length: 200,
        },
        picture,
        {
          key: "back",
          type: "short_text",
          label: t("الظهر", "Verso", "Back"),
          hint: t(
            "المعنى أو الترجمة، يُكشف عند الطلب.",
            "Le sens ou la traduction, révélé à la demande.",
            "The meaning or translation, revealed on request.",
          ),
          required: true,
          max_length: 300,
        },
        {
          key: "example",
          type: "long_text",
          label: t("مثال", "Exemple", "Example"),
          hint: t(
            "اختياري. جملة تُظهر الاستعمال؛ تُكشف مع الظهر.",
            "Facultatif. Une phrase d’usage, révélée avec le verso.",
            "Optional. A sentence showing usage, revealed with the back.",
          ),
          required: false,
          max_length: 1000,
        },
        {
          key: "tags",
          type: "item_list",
          label: t("وسوم", "Étiquettes", "Tags"),
          hint: t(
            "اختياري. كلمات لتصنيف البطاقة.",
            "Facultatif. Des mots pour classer la carte.",
            "Optional. Words to classify the card.",
          ),
          required: false,
          min_items: 0,
          max_items: 10,
        },
      ],
      graded_field: null,
      scoring: { evaluator: "self_assessment", reveal_fields: ["back", "example"] },
    },
  ],
  templates: [
    {
      id: "deck-starter",
      name: t("مجموعة بطاقات", "Jeu de cartes", "Card deck"),
      description: t(
        "ثلاث بطاقات فارغة لتبدأ منها.",
        "Trois cartes vides pour commencer.",
        "Three empty cards to start from.",
      ),
      items: [
        { activity: "card", hints: {} },
        { activity: "card", hints: {} },
        { activity: "card", hints: {} },
      ],
    },
  ],
  custom_schema: false,
  assets_allowed: ["image"],
  capabilities_required: [],
};

const limits = { max_templates: 10, max_definition_bytes: 256 * 1024 };
const outDir = join(process.cwd(), "plugins", "core");
mkdirSync(outDir, { recursive: true });

for (const draft of [classicExercises, vocabCards]) {
  const result = definitionFromDraft(draft, limits);
  if (!result.ok) {
    console.error(draft.plugin_id, JSON.stringify(result.issues, null, 2));
    process.exit(1);
  }
  const file = join(outDir, `${draft.plugin_id}.lisanplugin.json`);
  writeFileSync(file, exportDefinition(result.definition));
  console.log(
    `${draft.plugin_id}: ${definitionSha256(result.definition)} -> plugins/core/${draft.plugin_id}.lisanplugin.json`,
  );
}
