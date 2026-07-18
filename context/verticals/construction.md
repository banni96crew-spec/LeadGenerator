# Vertical: construction

| Field | Value |
|-------|--------|
| `vertical` id | `construction` |
| `template` | `atrium-v1` |
| Niche | Премиум-строительство частных домов / под ключ |
| Audience | Заказчики домов: участок, смета, архитектура, сроки |

## Niche signals

- Услуги: проектирование, строительство под ключ, инженерия, контроль на площадке.
- Боли: скрытые доплаты, срыв сроков, смена узлов «по ходу», отсутствие одного ответственного.
- Доверие: фиксированная смета, понятный график, приёмка скрытых работ, гарантия на конструкцию.

## Section order (slots = content.json)

1. **hero** — `headline`, `subheadline`, `cta_primary`, `cta_secondary`
2. **proof[]** — ровно 4: `value`, `label` (без выдуманных цифр; digit-primary только с evidence в lead/audit|research)
3. **approach** — `eyebrow`, `h2`, `prose`, `steps[4]` `{title,text}`
4. **projects** — `eyebrow`, `h2`, `lead`, `items[3]` `{title,text}`
5. **materials** — `eyebrow`, `h2`, `prose`, `items[3]` strings
6. **footer_tagline** — строка после ©

Телефон / geo — из `lead.json` (не из content).

## Static blocks (Copy не заполняет wording)

- **promise** — смета / график / ответственный (цвета через brand CSS vars)
- **contact** form chrome — labels / legal / submit «Запросить консультацию»
- Nav labels: Подход / Проекты / Материалы / Консультация
- **Нет** `faq`, **нет** sticky mobile-bar

## Copy tone

См. [context/tone-of-voice.md](../tone-of-voice.md). Деловой, конкретный, без клише и выдуманных метрик.

## Aesthetic direction (Design)

- Atrium layout + construction chrome: stone/cream neutrals, accent from brand (`#9c7a3c` default in tokens if unset).
- Hero: full-bleed house photo; brand colors on `:root` (`--ink`, `--accent`, …) including fixed sections.
- Self-hosted Onest; motion = CSS + deferred `main.js` (nav / reveal / form) + `prefers-reduced-motion`.
- Prefer `capture/logo.*` и `photo-*` в `design/dist/assets/`; если capture пуст — defaults из `context/design-system/assets/`.
- Template id в `build.json`: **`atrium-v1`**.

## Slot → design-system

Слоты Mustache как в [design-system/README.md](../design-system/README.md). Сборка: dual `SLOT:header` + `SLOT:partials` → `design/dist/index.html`.
