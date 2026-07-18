/**
 * Code tone lint for Offer (G6 stand-in for PRD LLM tone-check).
 * Reuses banned-phrase / AI-marker heuristics from auditTextLinter (G2).
 */

const WHY_MIN_LENGTH = 40;

/** Same filler / template phrases as auditTextLinter. */
const BANNED_PHRASES = [
  "необходимо",
  "следует",
  "важно понимать",
  "данный аспект",
  "оптимизация",
  "пользовательский опыт",
  "эффективное взаимодействие",
  "рекомендуется",
  "требуется",
  "важно отметить",
  "по сути",
  "в целом",
  "инновационные решения",
  "индивидуальный подход",
  "комплексный подход",
  "chatgpt",
];

const AI_MARKER_PHRASES = ["как ии", "как ai", "как модель", "chatgpt"];

const AI_MARKER_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\(\s*скептичн\w*\s*\)/iu, label: "bracket_aside_skeptical" },
  { pattern: /\(\s*в\s+хорошем\s+смысле\s*\)/iu, label: "bracket_aside_good_sense" },
  { pattern: /\(\s*на\s+самом\s+деле\s*\)/iu, label: "bracket_aside_actually" },
];

function checkAiMarkers(text: string): string[] {
  const lower = text.toLowerCase();
  for (const phrase of AI_MARKER_PHRASES) {
    if (lower.includes(phrase)) {
      return [`reason=ai_marker detected phrase=${phrase}`];
    }
  }
  for (const { pattern, label } of AI_MARKER_PATTERNS) {
    if (pattern.test(text)) {
      return [`reason=ai_marker detected pattern=${label}`];
    }
  }
  return [];
}

function checkBannedPhrases(text: string): string[] {
  const lower = text.toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) {
      return [`reason=banned_phrase detected phrase=${phrase}`];
    }
  }
  return [];
}

export type LintOfferInput = {
  message: string;
  why_this_company: string;
  /** When set (from lead.json), require name in message or why_this_company. */
  companyName?: string;
};

/**
 * Lint client-facing offer fields. Read-only; returns reason strings for the gate.
 */
export function lintOfferClientText(input: LintOfferInput): string[] {
  const errors: string[] = [];
  const why = input.why_this_company.trim();

  if (why.length < WHY_MIN_LENGTH) {
    errors.push(
      `reason=why_this_company too short length=${why.length} min=${WHY_MIN_LENGTH}`
    );
  }

  const combined = `${input.message}\n${input.why_this_company}`;
  errors.push(...checkAiMarkers(combined));
  errors.push(...checkBannedPhrases(combined));

  const name = input.companyName?.trim();
  if (name) {
    if (!combined.toLowerCase().includes(name.toLowerCase())) {
      errors.push(`reason=company_name missing expected=${name}`);
    }
  }

  return errors;
}
