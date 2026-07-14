/**
 * Minimal Mustache subset for design-system slots:
 * {{a.b}}, {{.}}, {{#arr}}…{{/arr}}, {{#x}}…{{/x}}, {{^x}}…{{/x}}
 *
 * photos.N: when photos[N] is `{ src: string }`, dotted leaf resolves to the string
 * so {{photos.0}} works alongside {{#photos}}{{src}}{{/photos}}.
 */

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function unwrapPhotoLeaf(value: unknown): unknown {
  if (
    isPlainObject(value) &&
    typeof value.src === "string" &&
    Object.keys(value).length === 1
  ) {
    return value.src;
  }
  return value;
}

function lookupPath(contexts: unknown[], path: string): unknown {
  if (path === "." || path === "this") {
    return contexts[0];
  }
  const parts = path.split(".");
  for (const ctx of contexts) {
    let cur: unknown = ctx;
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      if (cur == null) {
        ok = false;
        break;
      }
      if (Array.isArray(cur) && /^\d+$/.test(part)) {
        const el = cur[Number(part)];
        cur = i === parts.length - 1 ? unwrapPhotoLeaf(el) : el;
      } else if (typeof cur === "object") {
        cur = (cur as Record<string, unknown>)[part];
      } else {
        ok = false;
        break;
      }
    }
    if (ok && cur !== undefined) return cur;
  }
  return undefined;
}

function isTruthy(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") return v.length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v as object).length > 0;
  return Boolean(v);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function findSectionEnd(
  template: string,
  from: number,
  name: string
): { contentStart: number; contentEnd: number; after: number } {
  let depth = 1;
  let i = from;
  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      throw new Error(`Unclosed mustache section: ${name}`);
    }
    const close = template.indexOf("}}", open);
    if (close === -1) {
      throw new Error("Unclosed mustache tag");
    }
    const raw = template.slice(open + 2, close).trim();
    const next = close + 2;
    if (raw.startsWith("#") || raw.startsWith("^")) {
      if (raw.slice(1).trim() === name) depth++;
    } else if (raw.startsWith("/")) {
      if (raw.slice(1).trim() === name) {
        depth--;
        if (depth === 0) {
          return { contentStart: from, contentEnd: open, after: next };
        }
      }
    }
    i = next;
  }
  throw new Error(`Unclosed mustache section: ${name}`);
}

function render(template: string, contexts: unknown[]): string {
  let out = "";
  let i = 0;
  while (i < template.length) {
    const open = template.indexOf("{{", i);
    if (open === -1) {
      out += template.slice(i);
      break;
    }
    out += template.slice(i, open);
    const close = template.indexOf("}}", open);
    if (close === -1) {
      out += template.slice(open);
      break;
    }
    const tag = template.slice(open + 2, close).trim();
    i = close + 2;

    if (tag.startsWith("#")) {
      const name = tag.slice(1).trim();
      const section = findSectionEnd(template, i, name);
      const inner = template.slice(section.contentStart, section.contentEnd);
      i = section.after;
      const value = lookupPath(contexts, name);
      if (Array.isArray(value)) {
        for (const item of value) {
          out += render(inner, [item, ...contexts]);
        }
      } else if (isTruthy(value)) {
        out += render(inner, [value, ...contexts]);
      }
    } else if (tag.startsWith("^")) {
      const name = tag.slice(1).trim();
      const section = findSectionEnd(template, i, name);
      const inner = template.slice(section.contentStart, section.contentEnd);
      i = section.after;
      const value = lookupPath(contexts, name);
      if (!isTruthy(value)) {
        out += render(inner, contexts);
      }
    } else if (tag.startsWith("/")) {
      // Stray closer — leave as-is so G4 can catch leftovers
      out += `{{${tag}}}`;
    } else {
      const value = lookupPath(contexts, tag);
      if (value == null) {
        out += "";
      } else if (typeof value === "object") {
        out += "";
      } else {
        out += escapeHtml(String(value));
      }
    }
  }
  return out;
}

export function renderMustache(
  template: string,
  data: Record<string, unknown>
): string {
  return render(template, [data]);
}
