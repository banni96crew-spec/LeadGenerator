# Vertical: renovation

| Field | Value |
|-------|--------|
| `vertical` id | `renovation` |
| `template` | `renovation-v1` |
| Niche | Ремонт квартир / дизайн-ремонт под ключ |
| Audience | Владельцы квартир в крупных городах (Москва / МО и аналоги) |

## Niche signals

- Услуги: ремонт под ключ, дизайн-проект, чистовая отделка, инженерные работы.
- Боли: срыв сроков, раздувание сметы, «бригада пропала», нет фото реальных объектов.
- Доверие: фиксированная смета, сроки в договоре, гарантия, фото до/после.

## Section order (slots = content.json)

1. **hero** — `headline`, `subheadline`, `cta`
2. **benefits[]** — минимум 3: `title`, `text` (сроки, смета, гарантия / процесс)
3. **social_proof** — `cases` и/или `reviews` (только факты из audit/research/lead; без выдуманных отзывов)
4. **contact** — `phone`, `cta`

## Copy tone

См. [context/tone-of-voice.md](../tone-of-voice.md). Деловой, конкретный, без «инновационных решений».

## Aesthetic direction (Design)

- Calm materials: тёплый нейтральный фон, один глубокий зелёно-графитовый accent.
- Hero: full-bleed photo из capture (если есть), бренд/логотип как сильный first-viewport signal.
- Nonlinear grid: не три одинаковые карточки подряд.
- Реальные `capture/logo.png` и `photo-*.png` в `design/dist/assets/`.
- Template id в `build.json`: **`renovation-v1`**.

## Slot → design-system

Слоты Mustache как в [design-system/README.md](../design-system/README.md). Сборка: `shell.html` → `design/dist/index.html`.
