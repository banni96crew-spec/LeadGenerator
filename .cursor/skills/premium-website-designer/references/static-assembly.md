# Static assembly — LeadGenerator pipeline (M3+)

## Когда читать

Design stage в LeadGenerator: есть `content.json`, `context/design-system/`, vertical template (`context/verticals/*.md`), capture assets (`capture/logo.png`, photos). Выход — static HTML/CSS в `leads/{id}/design/dist/` + `design/build.json`.

**Не** читай `optional-next-bootstrap.md` в этом контексте — pipeline запрещает SPA/framework bootstrap.

## Входы (minimal-io)

| Артефакт | Назначение |
|----------|------------|
| `content.json` | Слоты: hero, benefits, social_proof, contact |
| `context/design-system/*` | HTML partials, `tokens.css`, `base.css` |
| `context/verticals/{vertical}.md` | Порядок секций, niche signals, aesthetic note |
| `capture/logo.png`, `capture/photos/*` | Реальные ассеты клиента в dist |

## Сборка (A1 agent)

1. Прочитай vertical → определи `template` id (e.g. `renovation-v1`).
2. Скопируй design-system partials в `design/dist/` или собери `index.html` из partials.
3. Замени слоты: `{{hero.headline}}`, `{{hero.subheadline}}`, `{{hero.cta}}`, benefits loop, social_proof, contact.
4. Инжектируй `brand_tokens`: primary color, font stack, logo path из capture + design-system defaults.
5. Скопируй `capture/logo.png` и релевантные photos в `design/dist/assets/` (или paths из vertical).
6. Запиши `design/build.json`: `schema_version`, `template`, `brand_tokens`, `build_dir: "design/dist"`, `screens` (заполнятся после render-preview).
7. **Не** запускай render-preview — orchestrator делает это в `runDesignGate`.

## CSS-only motion (pipeline)

В `design/dist` **нет** client JS bundles. Motion = CSS subset premium principles:

```css
@media (prefers-reduced-motion: no-preference) {
  .reveal { transition: opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
```

- Hover: `transition` на border/shadow/opacity, не transform spam.
- Scroll-driven JS (Lenis/GSAP/Framer) — **вне** pipeline static dist.

## Slot syntax (normative)

- Mustache-style: `{{section.field}}`, `{{#benefits}}...{{/benefits}}` или явный loop в agent assembly.
- Слоты должны совпадать с `content.schema.json` и design-system README slot map.

## Anti-patterns (static dist)

- React/Next/Vue, npm build step в dist, bundled JS для motion.
- Google Fonts CDN — self-host или system stack (кириллица: Inter, Manrope, IBM Plex, Onest).
- Purple gradients, card spam, free-form CSS вне design-system tokens.

## Delivery checklist (pipeline)

- [ ] `design/dist/index.html` открывается локально с относительными assets.
- [ ] Кириллица читаема на mobile и desktop.
- [ ] Один accent, nonlinear grid, generous whitespace.
- [ ] Client logo/photos из capture видны в демо.
- [ ] `build.json` валиден по `design-build.schema.json`.
- [ ] Нет horizontal overflow на mobile (проверит G4 после render-preview).
