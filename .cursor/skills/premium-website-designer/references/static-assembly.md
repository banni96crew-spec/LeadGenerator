# Static assembly — LeadGenerator pipeline (M3+)

## Когда читать

Design stage в LeadGenerator: есть `content.json`, `context/design-system/`, vertical template (`context/verticals/construction.md`), capture assets (`capture/logo.png`, photos). Выход — static HTML/CSS (+ deferred `main.js`) в `leads/{id}/design/dist/` + `design/build.json`.

**Не** читай `optional-next-bootstrap.md` в этом контексте — pipeline запрещает SPA/framework bootstrap.

## Входы (minimal-io)

| Артефакт | Назначение |
|----------|------------|
| `content.json` | Слоты: hero, trust, symptoms, why_us, contact |
| `context/design-system/*` | `shell.html`, partials, `tokens.css`, `base.css`, `main.js`, `assets/` |
| `context/verticals/construction.md` | Порядок секций, niche signals, aesthetic note |
| `capture/logo.png`, `capture/photos/*` | Реальные ассеты клиента (если есть) |

## Сборка (код: `assembleDesign`)

1. Прочитай vertical → `template` id: **`atrium-v1`**.
2. `copyDesignSystem`: скопируй `tokens.css`, `base.css`, `fonts/`, `assets/`, **`main.js`** в `design/dist/`.
3. Собери `index.html` из `shell.html` с dual slots:
   - `<!-- SLOT:header -->` ← `HEADER_PARTIAL` = `header`
   - `<!-- SLOT:partials -->` ← `BODY_PARTIALS` = `hero` → `proof` → `approach` → `projects` → `materials` → `promise` → `contact` → `footer`
4. Замени Mustache-слоты из `content.json` + `brand_tokens`.
5. Скопируй capture logo/photos в `design/dist/assets/` когда есть; `padPhotoSrcs` дополняет до **≥5** через `DEFAULT_PHOTO_RELS`.
6. Запиши `design/build.json` (`template: atrium-v1`).
7. **Не** запускай render-preview — orchestrator делает это в `runDesignGate`.

### DEFAULT_PHOTO_RELS

```
assets/hero-house.png
assets/project-exterior.png
assets/project-interior.png
assets/hero-house.png
assets/materials-detail.png
```

## Статические блоки (Copy не заполняет)

- `partials/approach.html` (steps)
- `partials/promise.html`
- contact form chrome в `partials/contact.html`

**Нет** `faq`. **Нет** mobile-bar.

## Slot syntax (normative)

- Mustache: `{{hero.eyebrow}}`, `{{#trust}}...{{/trust}}`, `{{#symptoms}}...{{/symptoms}}`, `{{#why_us.N}}...`, `{{contact.phone}}`, `{{photos.0}}`, `{{brand.name}}` (header wordmark).
- См. `context/design-system/README.md`.

## Motion / JS

- CSS transitions + `prefers-reduced-motion`.
- Deferred vanilla `main.js` — **исключение**: nav scroll, reveal, form success only.
- Без framework bundles (React/Vue/Next и т.п.).
- Без Google Fonts CDN — self-hosted `fonts/*.woff2`.

## Anti-patterns (static dist)

- Unsplash / внешние `img src`.
- React/Next/Vue, Google Fonts CDN.
- FAQ partial, sticky mobile-bar.
- Fake trust metrics в шаблоне.

## Delivery checklist (pipeline)

- [ ] `design/dist/index.html` без `{{`.
- [ ] Capture logo/photos в dist когда есть; иначе design-system defaults (pad ≥5).
- [ ] `main.js` скопирован; shell грузит его с `defer`.
- [ ] `build.json` валиден; `template: atrium-v1`.
- [ ] `prefers-reduced-motion` в CSS.
