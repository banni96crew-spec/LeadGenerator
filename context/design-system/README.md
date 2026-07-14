# Design System — Clinic (v1)

Static HTML/CSS partials for Design assembly. **No SPA / frameworks.**

Aesthetic: calm Human-Warm clinic layout from Example CLINIC — warm neutrals, deep green-graphite accent (`#1c2b24`). Self-hosted **Onest** + **Manrope**.

## Slot map (normative)

| Slot | Usage |
|------|--------|
| `{{brand.name}}` | Document title, hero fallback name, footer |
| `{{brand.logo}}` | Relative path e.g. `assets/logo.svg` — hero only |
| `{{brand.primary}}` | CSS `--color-primary` override at build |
| `{{hero.eyebrow}}` | Hero niche/geo line |
| `{{hero.headline}}` | Hero H1 |
| `{{hero.subheadline}}` | Hero supporting line |
| `{{hero.cta}}` | Primary CTA (hero, header, why_us, form submit) |
| `{{#trust}}` … `{{title}}` / `{{text}}` … `{{/trust}}` | Trust bar (3–4 items) |
| `{{#symptoms}}` … `{{pain}}` / `{{solve}}` … `{{/symptoms}}` | Pain-list (min 4) |
| `{{#why_us}}` … `{{title}}` / `{{text}}` … `{{/why_us}}` | Why-us diff-list (min 3) |
| `{{contact.phone}}` | Display phone (form, FAQ, mobile-bar) |
| `{{contact.phone_digits}}` | Digits for `tel:` href |
| `{{contact.cta}}` | Form submit label, mobile-bar |
| `{{photos.0}}` | Hero background `src` |
| `{{photos.1}}` | Optional hero side visual |

## Static blocks (Copy does not fill)

- `partials/steps.html` — три шага до приёма
- `partials/faq.html` — типовые вопросы клиники
- `partials/contact-form.html` — декоративная форма (`action="#"`)

## Files

| File | Role |
|------|------|
| `tokens.css` | `@font-face` + CSS variables |
| `base.css` | Reset, typography, layout, motion |
| `fonts/*.woff2` | Onest 700/800 + Manrope 400/600 |
| `partials/*.html` | Section fragments |
| `shell.html` | HTML shell; `assembleDesign` stitches partials |

## Assembly

1. `assembleDesign` loads `shell.html`, injects partials in order, renders Mustache.
2. Copy `tokens.css`, `base.css`, `fonts/` → `design/dist/`.
3. Replace slots from `content.json` + `brand_tokens`.
4. Copy capture logo/photos → `design/dist/assets/`.
5. Write `design/build.json` (`template: clinic-v1`).

## First viewport rules

- Header: nav + CTA only — **no logo in header**.
- Brand signal: logo or `{{brand.name}}` in hero only.
- Full-bleed hero photo from capture (`{{photos.0}}`); light scrim.
- Hero budget: brand + eyebrow + H1 + sub + one primary CTA.
- Mobile-bar: persistent below 680px, `tel:{{contact.phone_digits}}`.

## Anti-patterns

- Unsplash / external `img src` URLs.
- Fake trust metrics hardcoded in template (4.9, 12000+).
- Google Fonts CDN.
- Client JS bundles, React/Next.
- Stock placeholders when capture assets exist.
