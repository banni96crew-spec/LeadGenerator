const MAX_CLAIM_LENGTH = 280;
const MAX_IMPACT_LENGTH = 280;
const MAX_SUMMARY_LENGTH = 900;

const ANGLICISM_ALLOWLIST = new Set(["http", "https", "www"]);

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

const ABBREV_TOKEN = /\b[A-Z]{2,6}\b/g;
const LATIN_WORD = /\b[a-zA-Z]{3,}\b/g;
const PAREN_GROUP = /\([^)]+\)/g;
const ABBREV_EXPANSION = /\b[A-Z]{2,6}\s*\([^)]*[А-Яа-яЁё][^)]*\)/gu;

function isAbbreviationToken(word: string): boolean {
  return /^[A-Z]{2,6}$/.test(word);
}

function checkAbbreviationExpansions(text: string): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;

  ABBREV_TOKEN.lastIndex = 0;
  while ((match = ABBREV_TOKEN.exec(text)) !== null) {
    const token = match[0];
    if (seen.has(token)) continue;
    seen.add(token);

    const slice = text.slice(match.index, match.index + 80);
    const expansionPattern = new RegExp(
      `^${token}\\s*\\([^)]*[А-Яа-яЁё][^)]*\\)`,
      "u"
    );
    if (!expansionPattern.test(slice)) {
      errors.push(`reason=abbreviation not expanded token=${token}`);
    }
  }

  return errors;
}

function checkAnglicisms(text: string): string[] {
  const errors: string[] = [];
  let match: RegExpExecArray | null;

  LATIN_WORD.lastIndex = 0;
  while ((match = LATIN_WORD.exec(text)) !== null) {
    const word = match[0];
    if (isAbbreviationToken(word)) continue;
    if (ANGLICISM_ALLOWLIST.has(word.toLowerCase())) continue;
    errors.push(`reason=anglicism detected word=${word}`);
    break;
  }

  return errors;
}

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

function checkExtraBrackets(text: string): string[] {
  const allGroups = text.match(PAREN_GROUP) ?? [];
  const expansionGroups = text.match(ABBREV_EXPANSION) ?? [];
  const extra = allGroups.length - expansionGroups.length;
  if (extra > 0) {
    return [`reason=brackets_only_for_abbrev_expansion extra=${extra}`];
  }
  return [];
}

export function lintAuditClientText(
  findings: Array<Record<string, unknown>>,
  moneyLossSummary: string
): string[] {
  const errors: string[] = [];
  const textParts: string[] = [];

  if (typeof moneyLossSummary === "string") {
    if (moneyLossSummary.length > MAX_SUMMARY_LENGTH) {
      errors.push(
        `reason=field_too_long field=money_loss_summary length=${moneyLossSummary.length} max=${MAX_SUMMARY_LENGTH}`
      );
    }
    textParts.push(moneyLossSummary);
  }

  for (const finding of findings) {
    const id = String(finding.id ?? "unknown");
    const claim = String(finding.claim ?? "");
    const impact = String(finding.impact ?? "");

    if (claim.length > MAX_CLAIM_LENGTH) {
      errors.push(
        `reason=field_too_long finding id=${id} field=claim length=${claim.length} max=${MAX_CLAIM_LENGTH}`
      );
    }
    if (impact.length > MAX_IMPACT_LENGTH) {
      errors.push(
        `reason=field_too_long finding id=${id} field=impact length=${impact.length} max=${MAX_IMPACT_LENGTH}`
      );
    }

    textParts.push(claim, impact);
  }

  const combined = textParts.join("\n");
  errors.push(...checkAbbreviationExpansions(combined));
  errors.push(...checkAnglicisms(combined));
  errors.push(...checkAiMarkers(combined));
  errors.push(...checkBannedPhrases(combined));
  errors.push(...checkExtraBrackets(combined));

  return errors;
}
