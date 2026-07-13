# Design System — LeadGenerator (v1)

Static HTML/CSS partials for Design agent assembly. **No SPA / frameworks.**

Built with [premium-website-designer](../../.cursor/skills/premium-website-designer/SKILL.md): Silence, Typography, Nonlinear Grid, CSS-only Motion, Materiality.

## Slot map (normative)

| Slot | Usage |
|------|--------|
| `{{hero.headline}}` | Hero H1 |
| `{{hero.subheadline}}` | Hero supporting line |
| `{{hero.cta}}` | Primary CTA label |
| `{{#benefits}}` … `{{title}}` / `{{text}}` … `{{/benefits}}` | Benefit items (min 3) |
| `{{#social_proof.cases}}` … `{{.}}` … `{{/social_proof.cases}}` | Case lines |
| `{{#social_proof.reviews}}` … `{{.}}` … `{{/social_proof.reviews}}` | Review lines |
| `{{contact.phone}}` | Phone |
| `{{contact.cta}}` | Contact CTA |
| `{{brand.primary}}` | CSS `--color-primary` override |
| `{{brand.font}}` | Font stack |
| `{{brand.logo}}` | Relative path e.g. `assets/logo.png` |
| `{{#photos}}` … `{{src}}` … `{{/photos}}` | Capture photos copied to dist |

## Files

| File | Role |
|------|------|
| `tokens.css` | CSS variables (defaults; brand injected at build) |
| `base.css` | Reset, typography, layout, motion |
| `partials/hero.html` | First viewport |
| `partials/benefits.html` | Benefits section |
| `partials/social_proof.html` | Proof section |
| `partials/contact.html` | Contact / CTA |
| `partials/footer.html` | Footer |
| `shell.html` | Full page shell — Design copies to `index.html` and fills slots |

## Assembly

1. Copy `shell.html` → `leads/{id}/design/dist/index.html`.
2. Copy `tokens.css`, `base.css` → `design/dist/`.
3. Replace all slots from `content.json` + brand_tokens.
4. Copy capture logo/photos → `design/dist/assets/`.
5. Write `design/build.json` (`template`, `brand_tokens`, `build_dir`, `screens` placeholders).
6. Do **not** run render-preview — orchestrator owns it.

## Anti-patterns

- Purple/indigo SaaS gradients, card-in-card, rainbow accents.
- Google Fonts CDN — use system / self-host stack in `tokens.css`.
- Client JS bundles, React/Next, Lenis/GSAP in dist.
- Stock placeholders when `capture/logo.png` or photos exist.
