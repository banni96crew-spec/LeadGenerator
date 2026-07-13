# Optional Next.js bootstrap — вне LeadGenerator pipeline

> **Не использовать в pipeline M3–M4.** Design stage собирает static HTML через [static-assembly.md](static-assembly.md). Этот файл — только для standalone SPA-проектов вне LeadGenerator.

# Stack bootstrap — Next.js 16 + Tailwind v4 + Lenis + GSAP + Framer Motion

## Когда читать

Новый premium frontend scaffold **вне LeadGenerator pipeline** или добавление motion stack в существующий Next.js/Tailwind проект. Сначала проверь текущие версии, package manager и архитектуру — не применяй вслепую.

Минимальный boilerplate для премиум-сайта на современном стеке. Поднимает рабочий каркас за 5 минут.

## Что внутри

- **Next.js 16 App Router** + TypeScript strict
- **Tailwind CSS v4** — токены через `@theme` в `globals.css` (без `tailwind.config.js`)
- **Lenis** — smooth-scroll
- **GSAP + ScrollTrigger** — scroll-driven анимации
- **Framer Motion** — micro-interactions
- **Lucide React** — иконки
- **next/font** — Geist + Geist Mono (само-хостинг)

## 1. Создание проекта

```bash
npx create-next-app@latest my-premium-site \
  --typescript \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*" \
  --no-turbopack
cd my-premium-site
```

Next.js 16+ ставит Tailwind v4 по умолчанию. Если установился v3 — обнови:

```bash
npm install tailwindcss@latest @tailwindcss/postcss@latest
```

## 2. Установка motion-стека

```bash
npm install lenis gsap framer-motion lucide-react
```

Если нужен 3D:

```bash
npm install @react-three/fiber @react-three/drei three
npm install --save-dev @types/three
```

## 3. Tailwind v4 — `app/globals.css`

Tailwind v4 конфигурируется через `@theme` прямо в CSS. `tailwind.config.js` больше не нужен.

```css
@import "tailwindcss";

@theme {
  /* === BREAKPOINTS === */
  --breakpoint-xs: 480px;
  --breakpoint-sm: 640px;
  --breakpoint-md: 768px;
  --breakpoint-lg: 1024px;
  --breakpoint-xl: 1280px;
  --breakpoint-2xl: 1440px;
  --breakpoint-3xl: 1680px;

  /* === COLOR TOKENS === */

  /* Базовая графитовая шкала (бренд) */
  --color-bg-base: #0E0E0E;
  --color-bg-elev-0: #14141A;
  --color-bg-elev-1: #1A1A24;
  --color-bg-elev-2: #20202C;

  --color-fg-strong: #FAFAF7;
  --color-fg-base: #C4C4CA;
  --color-fg-muted: #8B8FA3;
  --color-fg-subtle: #545766;

  --color-border-subtle: rgba(255, 255, 255, 0.06);
  --color-border-base: rgba(255, 255, 255, 0.10);

  /* Акцент бренда (под замену) */
  --color-accent: #3CE0A0;
  --color-accent-strong: #1FD78F;
  --color-accent-subtle: rgba(60, 224, 160, 0.12);

  /* Системные */
  --color-success: #3CE0A0;
  --color-warning: #FBBF24;
  --color-error: #F87171;

  /* === TYPOGRAPHY === */
  --font-sans: var(--font-geist-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
  --font-mono: var(--font-geist-mono), "JetBrains Mono", "SF Mono", Menlo, monospace;

  /* Display sizes — clamp для responsive */
  --text-display-1: clamp(48px, 9vw, 112px);  /* hero h1 */
  --text-display-2: clamp(36px, 6vw, 72px);   /* section h2 */
  --text-display-3: clamp(28px, 4vw, 48px);   /* card h3 */
  --text-lead: clamp(18px, 2vw, 22px);        /* lead body */
  --text-body: 16px;                          /* body desktop */
  --text-caption: 13px;                       /* small labels */

  /* === SPACING === */
  /* base 4px grid, premium-spacing шкала */
  /* default tailwind spacing scale достаточно — sm:py-16 md:py-24 lg:py-32 lg:py-40 */

  /* === RADIUS === */
  --radius-card: 16px;
  --radius-modal: 24px;
  --radius-pill: 999px;
  /* НЕ ИСПОЛЬЗОВАТЬ радиусы > 24px на UI-элементах */

  /* === SHADOWS === */
  --shadow-card: 0 1px 2px rgba(0, 0, 0, 0.04), 0 8px 24px -12px rgba(0, 0, 0, 0.12);
  --shadow-modal: 0 8px 32px -8px rgba(0, 0, 0, 0.20), 0 32px 80px -16px rgba(0, 0, 0, 0.40);
  --shadow-glow: 0 0 32px -8px var(--color-accent-subtle);

  /* === MOTION === */
  --ease-out-quart: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in-out-quart: cubic-bezier(0.65, 0, 0.35, 1);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --duration-fast: 200ms;
  --duration-base: 300ms;
  --duration-slow: 600ms;
  --duration-scene: 1200ms;
}

/* === BASE STYLES === */
* {
  box-sizing: border-box;
}

html {
  background: var(--color-bg-base);
  color: var(--color-fg-base);
  /* НЕ ставь scroll-behavior smooth — этим управляет Lenis */
}

body {
  font-family: var(--font-sans);
  font-feature-settings: "ss01", "cv11";
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Premium-носители headings — точная типографика */
h1, h2, h3, h4 {
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 0.95;
  color: var(--color-fg-strong);
}

h1 { font-size: var(--text-display-1); }
h2 { font-size: var(--text-display-2); }
h3 { font-size: var(--text-display-3); }

p { line-height: 1.6; }

/* Reduced motion */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}

/* Selection */
::selection {
  background: var(--color-accent);
  color: var(--color-bg-base);
}

/* Focus-visible — premium */
*:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
  border-radius: 4px;
}
```

## 4. Шрифты — `app/layout.tsx`

```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SmoothScrollProvider } from "@/components/smooth-scroll-provider";

const geistSans = Geist({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-sans",
  display: "swap",
});

const geistMono = Geist_Mono({
  subsets: ["latin", "cyrillic"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://your-domain.com"),
  title: "Your Premium Site",
  description: "Site description — кратко, конкретно, без маркетинговых клише.",
  openGraph: {
    title: "Your Premium Site",
    description: "Site description",
    images: ["/og-image.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    images: ["/og-image.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="bg-bg-base text-fg-base antialiased">
        <SmoothScrollProvider>{children}</SmoothScrollProvider>
      </body>
    </html>
  );
}
```

## 5. Smooth-scroll provider — `components/smooth-scroll-provider.tsx`

```tsx
"use client";

import { useEffect, useRef } from "react";
import Lenis from "lenis";

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Не запускаем Lenis при prefers-reduced-motion
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      lerp: 0.1,
      wheelMultiplier: 1,
      smoothWheel: true,
    });

    lenisRef.current = lenis;

    function raf(time: number) {
      lenis.raf(time);
      requestAnimationFrame(raf);
    }
    const rafId = requestAnimationFrame(raf);

    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, []);

  return <>{children}</>;
}
```

## 6. GSAP + ScrollTrigger — пример секции

```tsx
"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function FeatureSection() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const ctx = gsap.context(() => {
      gsap.from(".feature-item", {
        opacity: 0,
        y: 60,
        duration: 0.8,
        stagger: 0.12,
        ease: "power3.out",
        scrollTrigger: {
          trigger: ref.current,
          start: "top 75%",
          end: "bottom 25%",
          toggleActions: "play none none reverse",
        },
      });
    }, ref);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={ref} className="py-32 md:py-40">
      <div className="container mx-auto max-w-7xl px-6">
        <h2 className="mb-16 max-w-2xl">Заголовок секции</h2>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.id} className="feature-item rounded-2xl border border-border-subtle bg-bg-elev-1 p-8 shadow-card">
              <h3 className="mb-4 text-xl">{f.title}</h3>
              <p className="text-fg-muted">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

const features = [
  { id: 1, title: "Feature 1", description: "Описание фичи." },
  { id: 2, title: "Feature 2", description: "Описание фичи." },
  { id: 3, title: "Feature 3", description: "Описание фичи." },
];
```

## 7. Framer Motion — magnetic кнопка

```tsx
"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";
import type { MouseEvent } from "react";

export function MagneticButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  const springX = useSpring(x, { stiffness: 150, damping: 15 });
  const springY = useSpring(y, { stiffness: 150, damping: 15 });

  function handleMouseMove(e: MouseEvent<HTMLButtonElement>) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    x.set((e.clientX - centerX) * 0.3);
    y.set((e.clientY - centerY) * 0.3);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.button
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={onClick}
      style={{ x: springX, y: springY }}
      className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-medium text-bg-base shadow-glow transition-shadow hover:shadow-[0_0_48px_-8px_var(--color-accent)]"
    >
      {children}
    </motion.button>
  );
}
```

## 8. Hero-секция (пример)

```tsx
import { ArrowRight } from "lucide-react";
import { MagneticButton } from "@/components/magnetic-button";

export function Hero() {
  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Premium-фон: noise + subtle glow */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-bg-base" />
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "url('/noise.png')",
            backgroundRepeat: "repeat",
          }}
        />
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="container mx-auto flex min-h-screen max-w-7xl items-center px-6">
        <div className="max-w-3xl">
          <p className="mb-8 inline-flex items-center gap-2 rounded-full border border-border-base bg-bg-elev-1 px-4 py-2 text-sm text-fg-muted">
            <span className="h-2 w-2 rounded-full bg-accent" />
            Tagline / status
          </p>
          <h1 className="mb-8 max-w-2xl">
            Премиум-заголовок<br />
            на двух строчках
          </h1>
          <p className="mb-12 max-w-xl text-lg leading-relaxed text-fg-muted md:text-xl">
            Lead-текст с конкретным объяснением, что это и кому. Без маркетинговых клише, без «революционных решений».
          </p>
          <MagneticButton>
            Узнать больше
            <ArrowRight className="h-4 w-4" />
          </MagneticButton>
        </div>
      </div>
    </section>
  );
}
```

## 9. Структура файлов

```
app/
  layout.tsx                 root layout с шрифтами + SmoothScrollProvider
  page.tsx                   главная (импортирует секции)
  globals.css                Tailwind v4 + @theme tokens
  not-found.tsx              404
components/
  smooth-scroll-provider.tsx Lenis
  magnetic-button.tsx        пример Framer Motion
  sections/
    hero.tsx
    features.tsx
    pricing.tsx
    footer.tsx
public/
  noise.png                  noise-текстура для surfaces (0.5-1% opacity)
  og-image.png               1200×630 OG
  assets/
    kit/                     photoreal-ассеты из Higgsfield
```

## 10. Validation после bootstrap

После того как поставил каркас и собрал hero:

```bash
npm run dev
# открыть http://localhost:3000
```

Проверь в браузере:

- [ ] Smooth-scroll работает (Lenis)
- [ ] H1 в hero рендерится в `clamp(48px, 9vw, 112px)`
- [ ] Кнопка magnetic — двигается за курсором
- [ ] `prefers-reduced-motion` — выключил в DevTools → Rendering, Lenis отключился
- [ ] Lighthouse mobile > 80 (DevTools → Lighthouse → Mobile + Performance)
- [ ] Шрифты прелоадятся (Network tab, woff2-файлы — preload)

Если всё чисто — каркас готов. Дальше идёшь по [audit-checklist.md](audit-checklist.md) на каждой новой секции.

## Что ещё может понадобиться (по запросу)

| Если нужен… | Поставь |
|---|---|
| 3D-объект в hero | `@react-three/fiber + @react-three/drei + three` |
| Form-handling | `react-hook-form + zod` |
| Toast-уведомления | `sonner` (light, premium-look) |
| Состояние клиента | `zustand` (light) или React Context |
| Marquee-эффект | сделать руками на Framer Motion (быстрее чем react-fast-marquee) |
| Tooltip | `@radix-ui/react-tooltip` + custom styling |
| Carousel | `embla-carousel-react` (light, премиум) |
| Date-picker | `react-day-picker` |
| Animation library поверх Framer | НЕ ставь GSAP+lottie+anime+motion одновременно. Выбери одно по задаче. |

## TL;DR

```bash
npx create-next-app@latest my-site --typescript --tailwind --app --no-src-dir --import-alias "@/*"
cd my-site
npm install lenis gsap framer-motion lucide-react
# скопируй globals.css из § 3
# скопируй SmoothScrollProvider из § 5
# скопируй hero.tsx из § 8
npm run dev
```

5 минут — рабочий премиум-каркас. Дальше доводишь до целевого стиля из [style-pack-references.md](style-pack-references.md).
