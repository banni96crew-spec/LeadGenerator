# Static assembly — LeadGenerator pipeline (M3+)

## Когда читать

Design stage в LeadGenerator: есть `content.json`, `context/design-system/`, vertical template (`context/verticals/clinic.md`), capture assets (`capture/logo.png`, photos). Выход — static HTML/CSS в `leads/{id}/design/dist/` + `design/build.json`.

**Не** читай `optional-next-bootstrap.md` в этом контексте — pipeline запрещает SPA/framework bootstrap.

## Входы (minimal-io)

| Артефакт | Назначение |
|----------|------------|
| `content.json` | Слоты: hero, trust, symptoms, why_us, contact |
| `context/design-system/*` | `shell.html`, partials, `tokens.css`, `base.css` |
| `context/verticals/clinic.md` | Порядок секций, niche signals, aesthetic note |
| `capture/logo.png`, `capture/photos/*` | Реальные ассеты клиента в dist |

## Сборка (код: `assembleDesign`)

1. Прочитай vertical → `template` id: **`clinic-v1`**.
2. Скопируй `tokens.css`, `base.css`, `fonts/` в `design/dist/`.
3. Собери `index.html`: `shell.html` + partials в порядке header → hero → trust → symptoms → why_us → steps → faq → contact-form → footer.
4. Замени Mustache-слоты из `content.json` + `brand_tokens`.
5. Скопируй capture logo/photos в `design/dist/assets/`.
6. Запиши `design/build.json`.
7. **Не** запускай render-preview — orchestrator делает это в `runDesignGate`.

## Статические блоки (Copy не заполняет)

- `partials/steps.html`, `partials/faq.html`, `partials/contact-form.html`

## Slot syntax (normative)

- Mustache: `{{hero.eyebrow}}`, `{{#trust}}...{{/trust}}`, `{{#symptoms}}...{{/symptoms}}`, `{{#why_us}}...{{/why_us}}`, `{{contact.phone}}`, `{{photos.0}}`.
- См. `context/design-system/README.md`.

## Anti-patterns (static dist)

- Unsplash / внешние `img src`.
- React/Next/Vue, Google Fonts CDN.
- Fake trust metrics в шаблоне.

## Delivery checklist (pipeline)

- [ ] `design/dist/index.html` без `{{`.
- [ ] Capture logo/photos в dist.
- [ ] `build.json` валиден; `template: clinic-v1`.
- [ ] `prefers-reduced-motion` в CSS.
