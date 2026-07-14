# Design System — LeadGenerator (v1)

Static HTML/CSS partials for Design agent assembly. **No SPA / frameworks.**

Built with [premium-website-designer](../../.cursor/skills/premium-website-designer/SKILL.md): Silence, Typography, Nonlinear Grid, CSS-only Motion, Materiality.

Aesthetic default: calm Human-Warm / Minimal-Lux — warm neutrals, one deep green-graphite accent (`#1c2b24`) and a restrained editorial layout. Self-hosted **Onest** (display) + **Manrope** (body).

## Slot map (normative)

| Slot | Usage |
|------|--------|
| `{{brand.name}}` | Document title, logo `alt`, text fallback when no logo, footer |
| `{{brand.logo}}` | Relative path e.g. `assets/logo.svg` / `assets/logo.png` — hero only |
| `{{brand.primary}}` | CSS `--color-primary` override at build; derived borders and hover states follow it automatically |
| `{{brand.font}}` | Optional stack hint in `brand_tokens`; design-system ships Onest + Manrope |
| `{{hero.headline}}` | Hero H1 |
| `{{hero.subheadline}}` | Hero supporting line |
| `{{hero.cta}}` | Primary CTA label (`.btn--primary`) |
| `{{#benefits}}` … `{{title}}` / `{{text}}` … `{{/benefits}}` | Benefit items (min 3) |
| `{{#social_proof.cases}}` … `{{.}}` … `{{/social_proof.cases}}` | Case lines |
| `{{#social_proof.reviews}}` … `{{.}}` … `{{/social_proof.reviews}}` | Review lines |
| `{{contact.phone}}` | Display phone |
| `{{contact.phone_digits}}` | Digits for `tel:` href |
| `{{contact.cta}}` | Contact CTA, quiet hero nav link and mobile direct-call action |
| `{{photos.0}}` | First capture photo — full-bleed hero media `src` |
| `{{#photos}}` … `{{src}}` … `{{/photos}}` | Photo strip in social proof (`photos[].src`) |

## Files

| File | Role |
|------|------|
| `tokens.css` | `@font-face` + CSS variables (defaults; primary injected at build) |
| `base.css` | Reset, typography, layout, motion |
| `fonts/*.woff2` | Self-hosted Onest 700/800 + Manrope 400/600 (latin + cyrillic) |
| `partials/hero.html` | First viewport (must match shell hero) |
| `partials/benefits.html` | Benefits section |
| `partials/social_proof.html` | Proof section |
| `partials/contact.html` | Contact / CTA |
| `partials/footer.html` | Footer |
| `shell.html` | Full page shell — Design copies to `index.html` and fills slots |

## Assembly

1. Copy `shell.html` → `leads/{id}/design/dist/index.html`.
2. Copy `tokens.css`, `base.css`, and `fonts/` → `design/dist/` (keep relative `./fonts/` paths).
3. Replace all slots from `content.json` + brand_tokens.
4. Copy capture logo/photos → `design/dist/assets/`.
5. Write `design/build.json` (`template`, `brand_tokens`, `build_dir`, `screens` placeholders).
6. Do **not** run render-preview — orchestrator owns it.

## First viewport rules

- One brand signal: logo (or `brand.name`) in hero only — no duplicate header logo.
- Full-bleed hero photo; light bottom scrim only (no heavy dim / logo invert).
- Hero budget: brand + headline + sub + one primary CTA + quiet nav text link. The next decision must be obvious within one screen.
- The mobile direct-call action is intentionally persistent below 680px; it uses the verified contact phone only.
- Generic fixed copy stays niche-neutral: "Почему выбирают нас", "Работу можно проверить", "Обсудим вашу задачу". Keep specific proof and promises in slots, never invent them in the template.

## Anti-patterns

- Purple/indigo SaaS gradients, card-in-card, rainbow accents, pill badge clutter.
- Google Fonts CDN — self-host only (`fonts/` + `@font-face` in `tokens.css`).
- Client JS bundles, React/Next, Lenis/GSAP in dist.
- `filter: invert` / brightness on logos (breaks colored SVG).
- Stock placeholders when `capture/logo` or photos exist.
