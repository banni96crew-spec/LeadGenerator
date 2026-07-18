# Design System — atrium-v1

Static HTML/CSS partials for Design assembly. **No SPA / frameworks.**

Aesthetic: atrium layout (full-bleed hero, proof band, approach steps, projects grid, materials, promise, contact). **Construction chrome** (Подход / Проекты / Материалы / Консультация). Self-hosted **Onest**.

## Shell

- `shell.html` — links `tokens.css` + `base.css`; injects brand CSS vars on `:root`
- `<!-- SLOT:header -->` outside `<main>`
- `<!-- SLOT:partials -->` inside `<main>`
- Deferred vanilla `main.js` — nav scroll, reveal, form success only

## PARTIALS (assembly order)

| Constant | Partial | Role |
|----------|---------|------|
| `HEADER_PARTIAL` | `header.html` | Fixed nav + wordmark (`{{brand.name}}`) → `SLOT:header` |
| `BODY_PARTIALS` | `hero.html` | Full-bleed hero + 2 CTAs |
| | `proof.html` | Proof loop (`{{#proof}}`) |
| | `approach.html` | LLM approach + 4 steps |
| | `projects.html` | Projects head + 3 cards + photos.1–3 |
| | `materials.html` | Materials + checklist + photo.4 |
| | `promise.html` | **Fixed wording** Принципы |
| | `contact.html` | Phone/geo from lead + **fixed** form chrome |
| | `footer.html` | Brand + `{{footer_tagline}}` |

**Not in atrium-v1:** FAQ partial, sticky phone / mobile-bar. Keep repo root `atrium/` as reference — do not delete.

## Copy contract

Copy fills `content.json` (`vertical: construction`):

| `content.json` | Partial |
|----------------|---------|
| `sections.hero` | hero |
| `sections.proof[]` | proof |
| `sections.approach` | approach |
| `sections.projects` | projects |
| `sections.materials` | materials |
| `footer_tagline` | footer |
| *(lead.phone / lead.geo)* | contact (assemble, not content) |

Static wording: `promise`, contact form chrome / submit «Запросить консультацию», nav labels.

## Slot map (normative)

| Slot | Usage |
|------|--------|
| `{{brand.name}}` | Title, header, hero, footer |
| `{{brand.primary}}` / `ink` / `accent_hover` / `accent_soft` | `:root` CSS vars (incl. fixed sections) |
| `{{hero.headline}}` / `subheadline` / `cta_primary` / `cta_secondary` | Hero |
| `{{#proof}}` … `{{value}}` / `{{label}}` | Proof band |
| `{{approach.*}}` / `{{approach.steps.N.*}}` | Approach |
| `{{projects.*}}` / `{{projects.items.N.*}}` | Projects |
| `{{materials.*}}` / `{{materials.items.N}}` | Materials |
| `{{contact.phone}}` / `phone_digits` / `note` | Contact (from lead) |
| `{{footer_tagline}}` | Footer line after © |
| `{{photos.N.src}}` | Image `src`; pad to ≥5 via defaults |

## Photos (pad = 5)

`assembleDesign` pads photo srcs to **≥5** using design-system assets when capture is short or empty.

## Anti-patterns

- Remote webfont / Google Fonts CDN
- Sticky phone call bar / FAQ
- Hardcoded fabricated proof metrics
- `contact` / `trust` / `symptoms` / `why_us` in content.json
- React/Next / external stock image URLs
- Deleting `atrium/`
