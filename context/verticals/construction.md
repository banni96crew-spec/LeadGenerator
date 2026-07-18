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

1. **hero** — `eyebrow`, `headline`, `subheadline`, `cta`
2. **trust[]** — 3–4: `title`, `text` (только факты из audit/research/lead; без выдуманных цифр) → design-system `proof`
3. **symptoms[]** — минимум 4: `pain`, `solve` → design-system `materials`
4. **why_us[]** — минимум 3: `title`, `text` → design-system `projects`
5. **contact** — `phone`, `cta` (данные для contact partial + form chrome)

## Static blocks (Copy не заполняет)

- **approach** — шаги от брифа до сдачи (steps chrome)
- **promise** — смета / график / ответственный
- **contact** form chrome — декоративная форма консультации
- **Нет** `faq`, **нет** sticky mobile-bar

## Copy tone

См. [context/tone-of-voice.md](../tone-of-voice.md). Деловой, конкретный, без клише и выдуманных метрик.

## Aesthetic direction (Design)

- Atrium layout + construction chrome: stone/cream neutrals, accent from brand (`#9c7a3c` default in tokens if unset).
- Hero: full-bleed house photo; logo — hero-primary brand signal. Header wordmark (`{{brand.name}}`) allowed (atrium).
- Self-hosted Onest + Manrope; motion = CSS + deferred `main.js` (nav / reveal / form) + `prefers-reduced-motion`.
- Prefer `capture/logo.*` и `photo-*` в `design/dist/assets/`; если capture пуст — defaults из `context/design-system/assets/`.
- Template id в `build.json`: **`atrium-v1`**.

## Slot → design-system

Слоты Mustache как в [design-system/README.md](../design-system/README.md). Сборка: dual `SLOT:header` + `SLOT:partials` → `design/dist/index.html`.
