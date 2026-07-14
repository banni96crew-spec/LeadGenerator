import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(path.join(root, "Example CLINIC", "style.css"), "utf8").replace(/\r\n/g, "\n");

function removeFromTo(text, start, end) {
  const s = text.indexOf(start);
  if (s === -1) {
    console.warn("start not found:", start.slice(0, 40));
    return text;
  }
  const e = text.indexOf(end, s + start.length);
  if (e === -1) {
    console.warn("end not found after:", start.slice(0, 40));
    return text.slice(0, s);
  }
  return text.slice(0, s) + text.slice(e);
}

const rootEnd = src.indexOf("/* ==========================================================================\n   Reset & global");
if (rootEnd === -1) throw new Error("Reset marker not found");
const tokens = src.slice(0, rootEnd).trim() + "\n";
let base = src.slice(rootEnd);

base = removeFromTo(
  base,
  "/* ==========================================================================\n   Cards & bento",
  "/* ==========================================================================\n   Why us"
);
base = removeFromTo(
  base,
  "/* ==========================================================================\n   Doctors",
  "/* ==========================================================================\n   Steps"
);
base = removeFromTo(
  base,
  "/* ==========================================================================\n   Reviews",
  "/* ==========================================================================\n   Steps"
);
base = removeFromTo(base, "/* Glass chips */", "/* ==========================================================================\n   Trust bar");

base = base.replace(/\.site-header__logo\s*\{[\s\S]*?\}\n\n/, "");

base += `
.hero__brand {
  margin-bottom: var(--space-6);
}
.hero__brand img {
  max-height: 2.5rem;
  width: auto;
}
.hero__brand-name {
  font-family: var(--font-display);
  font-size: var(--text-display-md);
  font-weight: 800;
  letter-spacing: var(--tracking-display);
}
@media (min-width: 960px) {
  .hero__layout--single {
    grid-template-columns: 1fr;
  }
}
.trust__inner {
  display: grid;
  gap: var(--space-6);
  width: min(100% - var(--gutter) * 2, var(--max-content));
  margin-inline: auto;
}
@media (min-width: 680px) {
  .trust__inner {
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: var(--space-8);
  }
}
`;

writeFileSync(path.join(root, "context", "design-system", "tokens.css"), tokens);
writeFileSync(path.join(root, "context", "design-system", "base.css"), base.trim() + "\n");
console.log("OK", base.length, "chars");
