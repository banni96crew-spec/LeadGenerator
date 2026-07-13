# Audit checklist — 30 пунктов «почему сайт выглядит дёшево»

## Когда читать

Визуальный аудит сайта, лендинга, hero-секции или компонента. Checklist — диагностический инструмент, не список пожеланий. Группировка: color → typography → layout → motion → material → content → SEO/perf.

---

## ЦВЕТ (1-5)

### 1. Радужные градиенты как из 2018

**Симптом:** `linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)` на кнопках, badge'ах, hero-фоне.

**Исправление:** solid color или subtle inner shadow. Глубина — `bg-gradient-to-b from-bg-elev-0 to-bg-elev-1` (1-2% разница), не радуга.

### 2. Больше одного акцентного цвета

**Симптом:** кнопки зелёная/синяя/оранжевая, бейджи всех цветов.

**Исправление:** ≤ 1 акcent + нейтральная шкала + семантические success/warning/error. Категории — типографикой, не цветом.

### 3. Низкий контраст текста

**Симптом:** body #999 на #FAFAFA, Lighthouse accessibility warnings.

**Исправление:** body ≥ 4.5:1 (#595959 на #FAFAFA), h1 ≥ 3:1.

### 4. Слишком яркая палитра

**Симптом:** `#00E676`, `#FF1744`, `#2962FF` — saturated пики.

**Исправление:** muted/desaturated. `#3CE0A0` вместо `#00E676`. Снижай saturation на 15-25%.

### 5. Цветной фон страницы

**Симптом:** body { background: lavender / cream / pastel-blue }.

**Исправление:** off-white #FAFAF7 / white / dark #0E0E0E. Цветной фон — только в локальных секциях.

---

## ТИПОГРАФИКА (6-11)

### 6. Слишком много размеров шрифта

**Исправление:** ≤ 5 размеров: 12px caption / 16px body / 20px lead / 32px h2 / 56px h1.

### 7. Слишком много весов

**Исправление:** ≤ 3 веса (400 / 500 / 700 или 400 / 700 / 900).

### 8. Стоковые шрифты по умолчанию

**Симптом:** Roboto, Open Sans, Lato.

**Исправление:** Geist, Inter + JetBrains Mono, Cabinet Grotesk + Satoshi (Fontshare).

### 9. Слабый hero-h1

**Исправление:** `clamp(48px, 9vw, 112px)`, letter-spacing `-0.04em`, line-height `0.9`, weight 700-800. Mobile ≥ 40px.

### 10. Body со слабой иерархией

**Исправление:** lead 18-22px fg-strong; body 16-18px fg-base; caption 13-14px fg-muted.

### 11. Кириллица плохо рендерится

**Исправление:** Inter, Manrope, IBM Plex, Cabinet Grotesk, Onest. Тест на h1.

---

## LAYOUT (12-17)

### 12. Всё центрировано

**Исправление:** left-aligned с accent справа. Centered — только для цитат/hero-объекта.

### 13. Слишком плотная сетка

**Исправление:** `py-32` или `py-40` между секциями. Уменьши число секций, не отступы.

### 14. Sticky-навбар «всегда сверху»

**Исправление:** без sticky или появляется только при scroll-up (Framer Motion + scrollY).

### 15. CTA-кнопка на первом экране

**Исправление:** hero — заголовок + lead, кнопки нет или тихая «Узнать больше →». CTA ниже.

### 16. Радиусы > 24px

**Исправление:** 12-16px на интерактивных, 20-24px на больших surface'ах, `rounded-full` только для pills/аватаров.

### 17. Линейная сетка без вариаций

**Исправление:** hero fullwidth → 1col → 2col split → 12col grid → quote → fullwidth canvas.

---

## MOTION (18-21)

### 18. Дефолтные ease-функции

**Исправление:** out-quart `cubic-bezier(0.22, 1, 0.36, 1)`, in-out-quart `cubic-bezier(0.65, 0, 0.35, 1)`.

### 19. Анимации играют сами по себе

**Исправление:** motion на hover/scroll/drag. Auto-loop — нет (кроме одного якорного объекта).

### 20. Нет smooth-scroll

**Исправление:** Lenis на root.

### 21. Игнор `prefers-reduced-motion`

**Исправление:** `@media (prefers-reduced-motion: reduce)` или `useReducedMotion()`.

---

## MATERIAL (22-25)

### 22. Плоский drop-shadow

**Исправление:** multi-layer shadow `0 1px 2px rgba(0,0,0,0.04), 0 8px 24px -12px rgba(0,0,0,0.12)` или border без shadow.

### 23. Storyset/Undraw/Open Doodles

**Исправление:** Higgsfield photoreal, R3F, editorial photography, заказные иллюстрации.

### 24. Эмодзи в UI

**Исправление:** Lucide / Heroicons / Phosphor SVG.

### 25. Плоские surface без noise

**Исправление:** noise-текстура 0.5-1% opacity (`public/noise.png` или SVG `<feTurbulence>`).

---

## CONTENT (26-28)

### 26. Маркетинг-копи

**Исправление:** конкретный, тихий copy. «Sound for music makers» (Stripe), «Develop. Preview. Ship.» (Vercel).

### 27. Sticky CTA в углу

**Исправление:** CTA в hero (тихо), середине, footer. Без floating buy-now.

### 28. Stock-фото людей в улыбке

**Исправление:** реальная съёмка, Higgsfield photoreal, или без людей.

---

## SEO / PERFORMANCE (29-30)

### 29. Lighthouse Mobile < 80

**Исправление:** `next/image`, `next/font`, lazy-load, preload hero, fixed `aspect-ratio`, dynamic-import тяжёлых компонентов. Target: Mobile ≥ 80, Desktop ≥ 90.

### 30. OG-картинка плохая или отсутствует

**Исправление:** 1200×630, ≤300KB, `metadataBase`, `openGraph.images`. Тест: opengraph.xyz.

---

## Как пользоваться

1. Открой сайт на laptop и mobile.
2. Пройди 30 пунктов, отметь нарушения.
3. Группируй: **High** (1-15) → **Medium** (16-25) → **Low** (26-30).
4. Исправляй high → medium → low. После каждой волны — mobile view + Lighthouse + 5-секундный тест.
5. 10+ нарушений — делай 5-10 за волну, не всё сразу.
