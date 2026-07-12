import path from "node:path";
import { fileURLToPath } from "node:url";

const CYRILLIC_MAP: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
  з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
  п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
  ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
  я: "ya",
};

export function slugify(name: string): string {
  const lower = name.trim().toLowerCase();
  let transliterated = "";
  for (const char of lower) {
    if (CYRILLIC_MAP[char]) {
      transliterated += CYRILLIC_MAP[char];
    } else {
      transliterated += char;
    }
  }
  return transliterated
    .normalize("NFC")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-") || "lead";
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

export function leadDir(leadId: string): string {
  return path.join(REPO_ROOT, "leads", leadId);
}

export function leadFile(leadId: string): string {
  return path.join(leadDir(leadId), "lead.json");
}

export function stateFile(leadId: string): string {
  return path.join(leadDir(leadId), "state.json");
}

export function captureDir(leadId: string): string {
  return path.join(leadDir(leadId), "capture");
}

export function metaFile(leadId: string): string {
  return path.join(captureDir(leadId), "meta.json");
}

export function resolveLeadPath(leadPath: string): string {
  const resolved = path.resolve(leadPath);
  if (resolved.endsWith(".json")) {
    return path.dirname(resolved);
  }
  return resolved;
}

export function normalizeSiteUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
