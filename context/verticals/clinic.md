# Vertical: clinic

| Field | Value |
|-------|--------|
| `vertical` id | `clinic` |
| `template` | `clinic-v1` |
| Niche | Частная клиника / медицинский центр |
| Audience | Пациенты, ищущие запись к врачу, диагностику, узких специалистов |

## Niche signals

- Услуги: терапия, диагностика, узкие специалисты, запись на приём.
- Боли: долгое ожидание, непонятная смета, страх скрытых доплат, откладывание обследования.
- Доверие: лицензия, опыт, прозрачная стоимость, запись на конкретное время.

## Section order (slots = content.json)

1. **hero** — `eyebrow`, `headline`, `subheadline`, `cta`
2. **trust[]** — 3–4: `title`, `text` (только факты из audit/research/lead; без выдуманных цифр)
3. **symptoms[]** — минимум 4: `pain`, `solve`
4. **why_us[]** — минимум 3: `title`, `text`
5. **contact** — `phone`, `cta` (данные для form/FAQ/mobile-bar; отдельной contact-секции нет)

## Static blocks (Copy не заполняет)

- **steps** — «Три шага до приёма»
- **faq** — типовые вопросы клиники
- **contact-form** — декоративная форма записи

## Copy tone

См. [context/tone-of-voice.md](../tone-of-voice.md). Деловой, спокойный, без запугивания и клише.

## Aesthetic direction (Design)

- Calm Human-Warm: тёплые нейтрали, один глубокий accent (`#1c2b24`).
- Hero: full-bleed photo из capture; бренд только в hero (header — nav + CTA).
- Self-hosted Onest + Manrope; CSS-only motion.
- Реальные `capture/logo.*` и `photo-*` в `design/dist/assets/`.
- Template id в `build.json`: **`clinic-v1`**.

## Slot → design-system

Слоты Mustache как в [design-system/README.md](../design-system/README.md). Сборка: `shell.html` → `design/dist/index.html`.
