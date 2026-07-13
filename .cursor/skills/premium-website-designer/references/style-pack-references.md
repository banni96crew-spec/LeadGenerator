# Style Pack & References

## Когда читать

Выбор aesthetic direction, палитры, font-pairing, визуального reference language. Справочник «нужен studio-look — открыл, забрал палитру и font-pairing». Не читай подряд.

## Optional upstream: ui-ux-pro-max-skill

Исторически skill работал поверх `nextlevelbuilder/ui-ux-pro-max-skill` — 50+ стилей, 161 палитра, 57 font pairings, 99 UX guidelines. В Cursor используй **локальные reference-файлы этого skill** как основной источник. Upstream — только если установлен:

```bash
git clone https://github.com/nextlevelbuilder/ui-ux-pro-max-skill.git ~/.cursor/skills/ui-ux-pro-max
```

## 12 базовых эстетических направлений

### 1. Editorial (журнальный)

**Когда:** портфолио, блог авторов, design-studio, premium-content платформы.
**Палитра:** монохром (off-white #FAFAF7 + графит #1A1A1A + акcent #FF4D14 или #C04000).
**Шрифты:** display serif (Playfair, Tiempos, Editorial New) + body serif/sans (Inter, Söhne).
**Эталоны:** bonjour.studio, are.na.
**Особенности:** display-заголовки 80-120px, мера строки 65-75ch, фотография как контент-блок.

### 2. Brutalist (брутализм)

**Когда:** агентство, портфолио креатора, эксперимент-сайт.
**Палитра:** яркий primary (#FF3D00, #0000FF, #00E676) + чёрный + белый.
**Шрифты:** geometric sans (Druk, Suisse Int'l, Founders Grotesk) + mono (Space Mono, JetBrains Mono).
**Эталоны:** balenciaga.com, areweb3yet.com.
**Особенности:** жёсткие сетки, типографика как hero, full-width цветовые блоки, скругления 0-4px.

### 3. Glassmorphism

**Когда:** SaaS-дашборды, fintech, AI-инструменты.
**Палитра:** градиент-фон + glass-карты `backdrop-filter: blur(40px)` + border `rgba(255,255,255,0.06)`.
**Шрифты:** clean sans (Inter, Söhne, Geist) + mono.
**Эталоны:** apple.com/vision-pro, stripe.com, linear.app.

### 4. Neumorphism

**Когда:** music-плееры, fitness-приложения, AI-помощники с soft-UI.
**Палитра:** soft pastel (#EEE7E0, #E0E5EC) + один accent.
**Шрифты:** soft sans (Inter, DM Sans, Plus Jakarta Sans).
**Особенности:** inset/outset shadows. Не для текстового контента (плохой контраст).

### 5. Cyberpunk / Neo-Tokyo

**Когда:** crypto / Web3 / games / tech-демо.
**Палитра:** #0A0E1A + neon (cyan #00F0FF + magenta #FF00C7 + green #00FF8C).
**Шрифты:** mono display (Berkeley Mono, JetBrains Mono Bold) + sans.

### 6. Studio (агентский)

**Когда:** дизайн-студия, продакшн, креативное агентство.
**Палитра:** off-white + графит + accent (горчичный, кобальт, бордо).
**Шрифты:** custom display + body sans (Söhne + Söhne Mono).
**Эталоны:** studio.design, instrument.com, basicagency.com, locomotive.ca.
**Особенности:** scroll-driven storytelling, cursor-effects, кинетическая типографика.

### 7. Minimal-Lux

**Когда:** премиум-продукты, e-commerce hi-end.
**Палитра:** #FFFFFF + #F5F5F7 + графит + edge-accent (silver / rose-gold / matte black).
**Шрифты:** SF Pro / Söhne / Inter.
**Эталоны:** apple.com, hermes.com, rimowa.com.

### 8. Tech-Noir

**Когда:** dev-tools, AI-инфраструктура, enterprise B2B.
**Палитра:** #0A0A0F + #1A1A24 + accent (acid green #00E676, electric blue #2196F3).
**Шрифты:** Geist + Geist Mono, Inter + JetBrains Mono.
**Эталоны:** linear.app, vercel.com, supabase.com.

### 9. Human-Warm

**Когда:** community, образование, lifestyle.
**Палитра:** #FAF6F0 + терракот #C04000 + графит.
**Шрифты:** humanist sans (Inter, DM Sans) + handwritten accent.
**Эталоны:** notion.so, calm.com, headspace.com.

### 10. Magazine-Photo

**Когда:** travel, food, lifestyle-бренды.
**Палитра:** определяется фотографиями + accent для текста.
**Шрифты:** editorial serif (Tiempos, Plantin, Lyon) + sans body.
**Эталоны:** cntraveller.com, kinfolk.com.

### 11. 3D-Surreal

**Когда:** product launches, brand statements, creative SaaS.
**Палитра:** off-white + яркий accent + 3D-объекты с собственной палитрой.
**Шрифты:** geometric display (Druk, Founders Grotesk) + sans.
**Эталоны:** stripe.com/sessions, vercel.com/ship.

### 12. Document-Grid

**Когда:** documentation, knowledge bases, research-платформы.
**Палитра:** white + графит + accent для links/CTA.
**Шрифты:** sans body (Inter / Söhne) + mono (JetBrains Mono / Geist Mono).
**Эталоны:** stripe.com/docs, vercel.com/docs.

## Где брать палитры

1. `ui-ux-pro-max` § palettes (если установлен)
2. realtimecolors.com, coolors.co, paletton.com
3. Brand referrals: linear.app, vercel.com, stripe.com — DevTools → CSS-переменные

## Где брать font-pairings

1. `ui-ux-pro-max` § font-pairings (если установлен)
2. fontsinuse.com, typewolf.com, fontshare.com
3. `next/font/google` для self-hosting

## Референс-сайты

- awwwards.com, godly.website, minimal.gallery, siteinspire.com
- lapa.ninja, savee.it

## Встроенные эталоны

peachweb.io · string-tune.fiddle.digital · apple.com/vision-pro · linear.app · vercel.com · raycast.com · cursor.com · stripe.com · studio.design · instrument.com · basicagency.com · locomotive.ca
