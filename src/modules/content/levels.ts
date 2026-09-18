import { z } from "zod";

export const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
export const CefrLevel = z.enum(CEFR_LEVELS);
export type CefrLevel = z.infer<typeof CefrLevel>;

/** Structured level: a CEFR band plus an optional sub-step (A1.1, A1.2 ...). Never free text. */
export const ProficiencyLevel = z.object({
  band: CefrLevel,
  sub: z.number().int().min(1).max(9).optional(),
});
export type ProficiencyLevel = z.infer<typeof ProficiencyLevel>;

export function formatLevel(level: ProficiencyLevel): string {
  return level.sub === undefined ? level.band : `${level.band}.${level.sub}`;
}

export function parseLevel(label: string): ProficiencyLevel | null {
  const match = /^(A1|A2|B1|B2|C1|C2)(?:\.([1-9]))?$/.exec(label.trim());
  if (!match) return null;
  return { band: match[1] as CefrLevel, ...(match[2] ? { sub: Number(match[2]) } : {}) };
}

export const LANGUAGE_SKILLS = ["listening", "reading", "pronunciation", "writing"] as const;
export const LanguageSkill = z.enum(LANGUAGE_SKILLS);
export type LanguageSkill = z.infer<typeof LanguageSkill>;
