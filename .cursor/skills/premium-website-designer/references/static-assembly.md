# Static assembly — LeadGenerator pipeline (M3+)

## Когда читать

Design stage в LeadGenerator: есть `content.json`, `context/design-system/`, vertical template (`context/verticals/construction.md`), capture assets (`capture/logo.png`, photos). Выход — static HTML/CSS (+ deferred `main.js`) в `leads/{id}/design/dist/` + `design/build.json`.

**Не** читай `optional-next-bootstrap.md` в этом контексте — pipeline запрещает SPA/framework bootstrap.

## Входы (minimal-io)

| Артефакт | Назначение |
|----------|------------|
| `content.json` | Слоты: hero, proof, approach, projects, materials, footer_tagline |
| `lead.json` | name, phone (required), geo (optional) |
| `context/design-system/*` | `shell.html`, partials, `tokens.css`, `base.css`, `main.js`, `assets/` |
| `context/verticals/construction.md` | Порядок секций, niche signals, aesthetic note |
| `capture/logo.png`, `capture/photos/*` | Реальные ассеты клиента (если есть) |

## Сборка (код: `assembleDesign`)

1. Прочитай vertical → `template` id: **`atrium-v1`**.
2. `copyDesignSystem`: скопируй `tokens.css`, `base.css`, `fonts/`, `assets/`, **`main.js`** в `design/dist/`.
3. Собери `index.html` из `shell.html` с dual slots:
   - `<!-- SLOT:header -->` ← `HEADER_PARTIAL` = `header`
   - `<!-- SLOT:partials -->` ← `BODY_PARTIALS` = `hero` → `proof` → `approach` → `projects` → `materials` → `promise` → `contact` → `footer`
4. Замени Mustache-слоты из `content.json` + brand CSS vars + lead phone/geo.
5. Скопируй capture logo/photos в `design/dist/assets/` когда есть; `padPhotoSrcs` дополняет до **≥5** через `DEFAULT_PHOTO_RELS`.
6. Запиши `design/build.json` (`template: atrium-v1`).
7. **Не** запускай render-preview — orchestrator делает это в `runDesignGate`.
8. **Не** удаляй корневой `atrium/`.

### DEFAULT_PHOTO_RELS

```
assets/hero-house.png
assets/project-exterior.png
assets/project-interior.png
assets/hero-house.png
assets/materials-detail.png
```

## Статические блоки (Copy не заполняет wording)

- `partials/promise.html`
- contact form chrome / submit в `partials/contact.html`
- nav labels в `header.html`

LLM заполняет: hero, proof, approach (+ steps), projects, materials, footer_tagline.

**Нет** `faq`. **Нет** mobile-bar.

## Slot syntax (normative)

- Mustache: `{{hero.cta_primary}}`, `{{#proof}}...{{/proof}}`, `{{approach.steps.0.title}}`, `{{projects.items.0.title}}`, `{{materials.items.0}}`, `{{contact.phone}}`, `{{photos.0.src}}`, `{{brand.name}}`, `{{footer_tagline}}`.
- Brand colors: `--ink`, `--accent`, `--accent-hover`, `--accent-soft` на `:root` (в т.ч. fixed sections).
- См. `context/design-system/README.md`.

## Motion / JS

- CSS transitions + `prefers-reduced-motion`.
- Deferred vanilla `main.js` — nav scroll, reveal, form success only.
- Без framework bundles (React/Vue/Next и т.п.).
- Без Google Fonts CDN — self-hosted `fonts/*.woff2`.

## Anti-patterns (static dist)

- Unsplash / внешние `img src`.
- React/Next/Vue, Google Fonts CDN.
- FAQ partial, sticky mobile-bar.
- Fake proof metrics в шаблоне / clinic slots (`trust`/`symptoms`/`why_us`).

## Delivery checklist (pipeline)

- [ ] `design/dist/index.html` без `{{`.
- [ ] Capture logo/photos в dist когда есть; иначе design-system defaults (pad ≥5).
- [ ] `main.js` скопирован; shell грузит его с `defer`.
- [ ] `build.json` валиден; `template: atrium-v1`.
- [ ] `prefers-reduced-motion` в CSS.
