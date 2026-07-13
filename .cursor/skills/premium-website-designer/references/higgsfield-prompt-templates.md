# Higgsfield prompt templates — 6 готовых шаблонов

## Когда читать

Photoreal hero asset, product/device mockup, dashboard scene, SaaS landing scene, portfolio cover или e-commerce product hero через Higgsfield CLI. Не читай для CSS/UI редизайна без генерации raster assets.

Готовые prompt-команды для генерации photoreal-мокапов в Higgsfield CLI. Все шаблоны проверены, дают премиум-результат на `nano_banana_2` модели в `2k`. Подставь переменные в `{{ }}` и запусти.

## Базовые правила

1. **Генерируй по одной картинке за раз** — не батч. Сгенерировал → проверил → следующий. Это экономит кредиты и даёт согласованную серию.
2. **Сначала проверь баланс:** `higgsfield account status`. Premium-мокап ~1.5-3 кредита на запрос (зависит от resolution и aspect-ratio).
3. **Aspect ratio для веба:**
   - Hero desktop: `16:9` или `21:9` (cinematic)
   - Hero mobile: `9:16`
   - Product/feature: `4:3` или `3:2`
   - Card image: `1:1` или `4:5`
   - Full-bleed image: `3:2`
4. **Resolution:** `2k` для финального продакшна, `1k` для draft.
5. **Сохранение:** `curl -sL "$URL" -o public/assets/<section>/<name>.png`.

## Шаблон 1: Hero photoreal

**Когда:** первый экран лендинга. Photoreal-объект как смысловой якорь для метафоры продукта (нить, сфера, дорога, лабиринт).

**Использует:** премиум-минимал, studio, 3D-surreal направления.

```bash
higgsfield generate create nano_banana_2 \
  --prompt "Premium hero shot: {{ key_object }} floating in the centre of a deep graphite environment (#0E0E0E to #1A1A24 gradient), {{ accent_color }} accent rim-light from upper-left, ultra-soft volumetric mist, photoreal product photography, 35mm equivalent lens, f/2.8 shallow depth of field, micro-contrast on object surface, no text, no logo, no people, no UI elements, no captions. Background: empty negative space with subtle film grain. Mood: contemplative, sophisticated, Apple Vision Pro launch aesthetic." \
  --aspect_ratio 16:9 \
  --resolution 2k \
  --wait
```

**Пример подстановки:**
- `{{ key_object }}` = "a single translucent glass thread, gently curving from left edge to right edge"
- `{{ accent_color }}` = "mint #3CE0A0"

**Что важно:**
- "no text, no logo, no people, no UI elements, no captions" — обязательно, иначе модель добавит лишнего.
- "f/2.8 shallow depth of field" — даёт depth-blur, отличает от плоской иллюстрации.
- "no captions" — Higgsfield иногда пишет водяные подписи в углу. Явный запрет помогает.

## Шаблон 2: Продуктовая страница (mockup экрана + контекст)

**Когда:** страница продукта с photoreal screenshot вашего интерфейса на устройстве. Apple-стилистика, RIMOWA-уровень.

**Использует:** minimal-lux, glassmorphism направления.

```bash
higgsfield generate create nano_banana_2 \
  --prompt "Premium product mockup: a {{ device_type }} ({{ device_finish }}) standing on a softly-lit minimal {{ surface_material }} surface, photographed at a {{ camera_angle }} angle, soft natural window light from upper-left, subtle reflection underneath device, photoreal commercial product photography, 50mm equivalent lens, f/4 medium depth of field, sharp focus on device, gentle vignette, off-white #FAFAF7 background, no text on device screen, no UI shown, no people, no captions, no watermarks." \
  --aspect_ratio 3:2 \
  --resolution 2k \
  --wait
```

**Пример подстановки:**
- `{{ device_type }}` = "MacBook Pro 14-inch"
- `{{ device_finish }}` = "Space Black aluminum"
- `{{ surface_material }}` = "warm oak table"
- `{{ camera_angle }}` = "three-quarter front"

**После генерации:** добавляешь свой UI-скриншот поверх экрана через CSS `mask-image` или композицию в Figma. Higgsfield рисует чистый экран, ты накладываешь свой.

## Шаблон 3: Dashboard (UI-карты + glow + glass)

**Когда:** SaaS-лендинг, AI-инструмент, dev-tool. Premium glass-card dashboard в hero.

**Использует:** glassmorphism, tech-noir направления.

```bash
higgsfield generate create nano_banana_2 \
  --prompt "Premium SaaS dashboard screenshot mockup: a clean dark dashboard UI ({{ ui_color_base }} background with subtle blue/{{ ui_accent }} glow accents) showing {{ dashboard_content }}, rendered at a slight {{ tilt_angle }} 3D tilt for depth, glass-morphism cards with backdrop-blur, monospace data labels, soft inner shadows, sharp pixel-perfect typography rendering, subtle floating layers, photoreal screen capture quality, no actual text content that says specific brand names, no real company logos, no captions, no watermarks. Camera: straight-on tech-product shoot." \
  --aspect_ratio 16:9 \
  --resolution 2k \
  --wait
```

**Пример подстановки:**
- `{{ ui_color_base }}` = "deep navy #0A0E1A"
- `{{ ui_accent }}` = "cyan #38BDF8"
- `{{ dashboard_content }}` = "a metrics overview with a primary chart, three KPI tiles, and a sidebar of items"
- `{{ tilt_angle }}` = "10-degree"

**Что важно:**
- Higgsfield не делает функциональные UI — рисует фотореалистичный «слепок UI». Это OK для hero, но не для документации.
- "no actual text content that says specific brand names" — защита от случайных слов "Spotify", "Apple" в мокапе.

## Шаблон 4: SaaS-лендинг (полная сцена)

**Когда:** hero-секция SaaS-стартапа. Хочется photoreal-сцены, где продукт встроен в реальный контекст.

**Использует:** studio, 3D-surreal, tech-noir.

```bash
higgsfield generate create nano_banana_2 \
  --prompt "Premium SaaS landing hero scene: a {{ device_combo }} arranged on a minimal {{ surface }} desk, photographed from {{ camera_angle }}, soft directional light from {{ light_direction }}, {{ accent_object }} as a small visual punctuation in foreground, photoreal commercial photography, 35mm equivalent lens, f/2.8 shallow depth of field, micro-contrast, no text, no UI screens shown, no people, no captions, no watermarks. Mood: {{ mood }}." \
  --aspect_ratio 21:9 \
  --resolution 2k \
  --wait
```

**Пример подстановки:**
- `{{ device_combo }}` = "a laptop, a wireless mouse, and a small ceramic mug"
- `{{ surface }}` = "warm walnut wood"
- `{{ camera_angle }}` = "top-down 75-degree angle"
- `{{ light_direction }}` = "the upper-right window"
- `{{ accent_object }}` = "a single green plant leaf"
- `{{ mood }}` = "calm focused morning, premium remote work setup"

## Шаблон 5: Портфолио (case study cover)

**Когда:** обложка кейса в портфолио агентства. Должна моментально передать стиль проекта без подписи.

**Использует:** editorial, brutalist, studio направления.

```bash
higgsfield generate create nano_banana_2 \
  --prompt "Premium portfolio case study cover: {{ visual_subject }}, rendered in {{ style_aesthetic }} aesthetic with {{ palette }} palette, full-bleed composition, ultra-clean negative space on the {{ negative_space_side }}, photoreal high-end commercial photography, {{ lens }}mm equivalent lens, shallow depth of field, film-grain texture overlay (subtle), no text, no logo, no people, no captions, no watermarks. Mood: {{ mood }}." \
  --aspect_ratio 4:5 \
  --resolution 2k \
  --wait
```

**Пример подстановки:**
- `{{ visual_subject }}` = "a single brushed-aluminum cube resting on a graphite surface, casting a soft shadow to the right"
- `{{ style_aesthetic }}` = "minimal-lux Apple-launch"
- `{{ palette }}` = "off-white #FAFAF7 + graphite #1A1A1A + single mint #3CE0A0 accent rim-light"
- `{{ negative_space_side }}` = "upper-left"
- `{{ lens }}` = "85"
- `{{ mood }}` = "contemplative, intentional, premium"

**Что важно:**
- "full-bleed composition" — изображение займёт весь кадр без полей.
- Aspect ratio `4:5` отлично работает для card-grid в портфолио.
- `85mm lens` даёт «portrait»-effect — продукт как герой.

## Шаблон 6: E-commerce (product hero)

**Когда:** карточка товара / premium-shop hero / product launch. Apple/Hermes-уровень product-photography.

**Использует:** minimal-lux, magazine-photo направления.

```bash
higgsfield generate create nano_banana_2 \
  --prompt "Premium e-commerce product hero: {{ product_name }} ({{ product_description }}), photographed at a clean three-quarter front angle on a {{ background_surface }} surface, single soft directional light from upper-left at 45 degrees, no harsh shadows, micro-contrast on material surface, photoreal high-end commercial product photography, 100mm macro equivalent lens, f/5.6 deep enough focus for product details, subtle reflection underneath product, no text, no logo, no people, no captions, no watermarks. Background: minimal {{ bg_color }} with very subtle gradient toward shadow. Mood: museum-piece, intentional, premium." \
  --aspect_ratio 4:5 \
  --resolution 2k \
  --wait
```

**Пример подстановки:**
- `{{ product_name }}` = "a single ceramic coffee mug"
- `{{ product_description }}` = "matte off-white finish with a single dark glaze drip"
- `{{ background_surface }}` = "warm beige stone slab"
- `{{ bg_color }}` = "off-white #FAFAF7"

**Что важно:**
- `100mm macro lens` — даёт «текстуру материала», важно для премиума.
- `f/5.6` — продукт в фокусе целиком, нет излишнего bokeh.
- Background «very subtle gradient» — не плоский, иначе сразу выглядит как stock-photo.

## Когда модель ошибается — что делать

Higgsfield иногда промахивается. Типичные проблемы и фиксы:

| Проблема | Что добавить в prompt |
|---|---|
| Модель добавляет текст «PRODUCT» / «BRAND» | `, no text, no labels, no captions, no watermarks` |
| Модель рисует людей хоть кого | `, no people, no humans, no body parts visible` |
| Слишком яркие цвета | `, muted color palette, low saturation, subtle tones` |
| Кадр слишком плоский | `, shallow depth of field f/2.8, micro-contrast, soft volumetric light` |
| Объект слишком в центре | `, asymmetric composition, object positioned in the {{ direction }} third` |
| Stock-photo вид | `, premium editorial photography, sophisticated lighting, commercial-grade` |
| UI выглядит детским | `, sharp pixel-perfect typography, monospace data labels, glass-morphism cards, professional dashboard aesthetic` |

## Что НЕ генерировать в Higgsfield

- **Иконки** — Higgsfield не делает чистые SVG. Используй Lucide.
- **Логотипы** — Higgsfield нестабилен в типографике. Используй gpt_image_2 если очень нужно, либо рисуй в Figma/Illustrator.
- **Чистый текстовый screenshot** — модель искажает буквы. Используй gpt_image_2 для типографики-heavy.
- **Анимация** — Higgsfield делает статику. Для motion — code (GSAP / Framer Motion / R3F) или другие модели (Higgsfield Soul, dedicated video-models).

## Когда переключиться на gpt_image_2 или flux_2

- **gpt_image_2** — типографика-heavy. Если в кадре должны быть читаемые буквы / надписи / UI с текстом. Хуже фотореализм, лучше текст.
- **flux_2** — fallback. Если nano_banana_2 даёт сильно мимо концепции. Иногда flux_2 интерпретирует абстрактные брифы точнее.

```bash
higgsfield generate create gpt_image_2 \
  --prompt "<text-heavy brief>" \
  --aspect_ratio 16:9 \
  --resolution 2k \
  --wait
```

## TL;DR

1. Выбери один из 6 шаблонов под задачу.
2. Подставь переменные `{{ }}` под бренд.
3. Запусти, дождись URL.
4. Скачай: `curl -sL "$URL" -o public/assets/<section>/<name>.png`.
5. Не понравилось — итерируй prompt (НЕ патчи PIL'ом).
6. Финальные ассеты — в `public/assets/kit/` для переиспользования.
