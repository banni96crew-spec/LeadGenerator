import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type LegacyBenefit = { title?: string; text?: string };
type LegacySocialProof = { cases?: string[]; reviews?: string[] };
type LegacyHero = {
  eyebrow?: string;
  headline?: string;
  subheadline?: string;
  cta?: string;
};
type LegacyContact = { phone?: string; cta?: string; phone_digits?: string };
type LegacySections = {
  hero?: LegacyHero;
  benefits?: LegacyBenefit[];
  social_proof?: LegacySocialProof;
  symptoms?: Array<{ pain?: string; solve?: string }>;
  why_us?: Array<{ title?: string; text?: string }>;
  trust?: Array<{ title?: string; text?: string }>;
  contact?: LegacyContact;
};

type LegacyContent = {
  schema_version?: string;
  vertical?: string;
  sections?: LegacySections;
  reuse_facts?: string[];
};

const PLACEHOLDER_SYMPTOMS = [
  {
    pain: "MIGRATE: review — укажите типичную боль пациента",
    solve: "MIGRATE: review — укажите решение клиники",
  },
  {
    pain: "MIGRATE: review — укажите типичную боль пациента",
    solve: "MIGRATE: review — укажите решение клиники",
  },
  {
    pain: "MIGRATE: review — укажите типичную боль пациента",
    solve: "MIGRATE: review — укажите решение клиники",
  },
  {
    pain: "MIGRATE: review — укажите типичную боль пациента",
    solve: "MIGRATE: review — укажите решение клиники",
  },
];

function isLegacyFormat(data: LegacyContent): boolean {
  const sections = data.sections;
  if (!sections) return false;
  return (
    data.vertical === "renovation" ||
    Array.isArray(sections.benefits) ||
    sections.social_proof !== undefined
  );
}

function deriveEyebrow(reuseFacts: string[]): string {
  const geo = reuseFacts.find((f) =>
    /москва|спб|санкт|область|город|район/i.test(f)
  );
  if (geo) return `Частная клиника · ${geo}`;
  return "Частная клиника";
}

function casesToTrust(cases: string[]): Array<{ title: string; text: string }> {
  return cases.slice(0, 4).map((line) => {
    const trimmed = line.trim();
    const dashIdx = trimmed.indexOf(" — ");
    const colonIdx = trimmed.indexOf(": ");
    let title = trimmed;
    if (dashIdx > 0 && dashIdx < 60) {
      title = trimmed.slice(0, dashIdx).trim();
    } else if (colonIdx > 0 && colonIdx < 60) {
      title = trimmed.slice(0, colonIdx).trim();
    } else if (trimmed.length > 48) {
      title = `${trimmed.slice(0, 45).trim()}…`;
    }
    return { title, text: trimmed };
  });
}

function migrateContent(data: LegacyContent): Record<string, unknown> {
  const sections = data.sections ?? {};
  const hero = sections.hero ?? {};
  const contact = sections.contact ?? {};
  const reuseFacts = Array.isArray(data.reuse_facts) ? [...data.reuse_facts] : [];

  const whyUs =
    Array.isArray(sections.why_us) && sections.why_us.length >= 3
      ? sections.why_us.map((item) => ({
          title: String(item.title ?? "").trim(),
          text: String(item.text ?? "").trim(),
        }))
      : (sections.benefits ?? []).map((item) => ({
          title: String(item.title ?? "").trim(),
          text: String(item.text ?? "").trim(),
        }));

  let trust =
    Array.isArray(sections.trust) && sections.trust.length >= 3
      ? sections.trust.map((item) => ({
          title: String(item.title ?? "").trim(),
          text: String(item.text ?? "").trim(),
        }))
      : [];

  if (trust.length < 3) {
    const cases = sections.social_proof?.cases ?? [];
    const reviews = sections.social_proof?.reviews ?? [];
    const fromCases = casesToTrust(cases);
    const fromReviews = casesToTrust(reviews);
    trust = [...fromCases, ...fromReviews].slice(0, 4);
  }

  if (trust.length < 3) {
    trust = [
      { title: "MIGRATE: review", text: "Добавьте факт доверия из audit/research" },
      { title: "MIGRATE: review", text: "Добавьте факт доверия из audit/research" },
      { title: "MIGRATE: review", text: "Добавьте факт доверия из audit/research" },
    ];
  }

  let symptoms =
    Array.isArray(sections.symptoms) && sections.symptoms.length >= 4
      ? sections.symptoms.map((item) => ({
          pain: String(item.pain ?? "").trim(),
          solve: String(item.solve ?? "").trim(),
        }))
      : [];

  if (symptoms.length < 4) {
    symptoms = PLACEHOLDER_SYMPTOMS;
  }

  return {
    schema_version: "1.0",
    vertical: "clinic",
    sections: {
      hero: {
        eyebrow: hero.eyebrow?.trim() || deriveEyebrow(reuseFacts),
        headline: String(hero.headline ?? "").trim(),
        subheadline: String(hero.subheadline ?? "").trim(),
        cta: String(hero.cta ?? "").trim(),
      },
      trust,
      symptoms,
      why_us: whyUs,
      contact: {
        phone: String(contact.phone ?? "").trim(),
        cta: String(contact.cta ?? "").trim(),
        ...(contact.phone_digits?.trim()
          ? { phone_digits: contact.phone_digits.trim() }
          : {}),
      },
    },
    reuse_facts: reuseFacts.length ? reuseFacts : ["MIGRATE: review"],
  };
}

function main(): void {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const fileArg = args.find((a) => !a.startsWith("--"));

  if (!fileArg) {
    console.error(
      "Usage: npm run migrate-content -- leads/{id}/content.json [--write]"
    );
    process.exit(1);
  }

  const filePath = path.resolve(fileArg);
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    console.error(`Cannot read: ${filePath}`);
    process.exit(1);
  }

  let data: LegacyContent;
  try {
    data = JSON.parse(raw) as LegacyContent;
  } catch {
    console.error(`Invalid JSON: ${filePath}`);
    process.exit(1);
  }

  if (!isLegacyFormat(data)) {
    console.log(`Already clinic format (or unknown): ${filePath}`);
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  }

  const migrated = migrateContent(data);
  console.warn(
    "WARN: best-effort migration — re-run Copy for quality: npm run pipeline -- --lead leads/{id} --stage copy --force"
  );
  console.log(JSON.stringify(migrated, null, 2));

  if (write) {
    writeFileSync(filePath, `${JSON.stringify(migrated, null, 2)}\n`, "utf8");
    console.warn(`Written: ${filePath}`);
  } else {
    console.warn("Dry-run — pass --write to overwrite file");
  }
}

main();
