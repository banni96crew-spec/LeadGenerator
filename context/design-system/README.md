# Design System — atrium-v1

Static HTML/CSS partials for Design assembly. **No SPA / frameworks.**

Aesthetic: atrium layout (full-bleed hero, proof band, approach steps, projects grid, materials, promise, contact). **Construction chrome** (Подход / Проекты / Материалы / Консультация). Self-hosted **Onest** (display) + **Manrope** (body/UI).

## Shell

- `shell.html` — links `tokens.css` + `base.css` only
- `<!-- SLOT:header -->` outside `<main>`
- `<!-- SLOT:partials -->` inside `<main>`
- Deferred vanilla `main.js` — **exception**: atrium nav scroll, reveal, form success only (no framework bundles)

## PARTIALS (assembly order)

| Constant | Partial | Role |
|----------|---------|------|
| `HEADER_PARTIAL` | `header.html` | Fixed nav + wordmark (`{{brand.name}}`) + mobile menu → `SLOT:header` |
| `BODY_PARTIALS` | `hero.html` | Full-bleed hero + logo mark + CTAs |
| | `proof.html` | Trust loop (`{{#trust}}`) — no hardcoded metrics |
| | `approach.html` | Static steps (бриф → сдача); eyebrow `{{hero.eyebrow}}` |
| | `projects.html` | Why-us cards 0..2 + photos |
| | `materials.html` | Symptoms checklist + photo |
| | `promise.html` | Static смета / график / ответственный |
| | `contact.html` | Phone + consultation form chrome |
| | `footer.html` | Brand + construction copyright |

**Not in atrium-v1:** FAQ partial, sticky phone / mobile-bar.

## Copy contract

Copy fills `content.json` only (`vertical: construction`):

| `content.json` | Partial |
|----------------|---------|
| `sections.hero` | hero |
| `sections.trust[]` | proof |
| `sections.why_us[]` | projects (slice 0..2) |
| `sections.symptoms[]` | materials |
| `sections.contact` | contact (phone / cta / digits) |

Static (Copy does **not** fill): `approach`, `promise`, contact form chrome.

## Slot map (normative)

| Slot | Usage |
|------|--------|
| `{{brand.name}}` | Title, **header wordmark**, hero fallback, footer |
| `{{brand.logo}}` | Optional hero mark (hero-primary brand signal) |
| `{{brand.primary}}` | `--accent` / `--color-primary` override |
| `{{hero.eyebrow}}` | Approach eyebrow only |
| `{{hero.headline}}` | Hero H1 |
| `{{hero.subheadline}}` | Hero lead |
| `{{hero.cta}}` | Primary CTA |
| `{{#trust}}` … `{{title}}` / `{{text}}` … `{{/trust}}` | Proof value / label |
| `{{#why_us.N}}` … `{{title}}` / `{{text}}` … | Projects cards (0..2) |
| `{{#symptoms}}` … `{{pain}}` / `{{solve}}` … | Materials checklist |
| `{{contact.phone}}` / `{{contact.phone_digits}}` / `{{contact.cta}}` | Contact block + form |
| `{{photos.N}}` | Image `src` (unwraps `{ src }`); pad to ≥5 via defaults |

## Photos (pad = 5)

`assembleDesign` pads photo srcs to **≥5** using `DEFAULT_PHOTO_RELS` from design-system assets when capture is short or empty:

- `assets/hero-house.png`
- `assets/project-exterior.png`
- `assets/project-interior.png`
- `assets/hero-house.png` (reuse)
- `assets/materials-detail.png`

Prefer capture photos/logo when present; defaults are authorized local fallbacks — not external stock URLs.

## Files

| File | Role |
|------|------|
| `tokens.css` | `@font-face` + CSS variables |
| `base.css` | Layout, components, `prefers-reduced-motion` |
| `main.js` | Header scroll, mobile nav, reveal, form (defer) |
| `fonts/*.woff2` | Onest 700/800 + Manrope 400/600 |
| `assets/*.png` | Default atrium photography fallbacks |
| `partials/*.html` | Section fragments |
| `shell.html` | HTML shell for `assembleDesign` |

## Assembly notes

1. Inject header via `SLOT:header`; remaining `BODY_PARTIALS` via `SLOT:partials` in table order.
2. `copyDesignSystem`: copy `tokens.css`, `base.css`, `fonts/`, `assets/`, `main.js` → `design/dist/`.
3. Render Mustache from `content.json` + `brand_tokens`.
4. Prefer capture photos when present; otherwise pad with atrium PNG fallbacks (pad = 5).

## Anti-patterns

- Remote webfont / Google Fonts CDN
- Undeclared monolithic stylesheet shell link (use tokens + base only)
- Sticky phone call bar / mobile-bar
- FAQ partial
- Healthcare / appointment niche chrome
- Hardcoded fabricated proof metrics (use `trust[]` only)
- React/Next / client SPA / framework bundles
- External stock image URLs
