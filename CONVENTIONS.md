# CONVENTIONS

Минимальный контекст для агентов и кода LeadGenerator pipeline.

## Пути

- Корень лида: `leads/{lead_id}/`
- `lead_id` = `slugify(name)` — lowercase, дефисы, кириллица транслитерируется
- Примеры slugify:
  - `Domeo` → `domeo`
  - `Домео` → `domeo`
  - `ООО Ремонт+` → `ooo-remont`
- Все пути в JSON-артефактах — **относительные** от корня лида (`capture/desktop.png`)
- Фото из capture: `capture/photo-1.jpg` (или `.png`/`.webp` — по Content-Type; до 3 шт.)
- Логотип: `capture/logo.{png|jpg|webp|svg}` — путь в `meta.assets.logo` (не хардкод `.png`)

## Контракты

| Файл | Схема |
|------|-------|
| `lead.json` | `schemas/lead.schema.json` |
| `state.json` | `schemas/state.schema.json` |
| `capture/meta.json` | `schemas/capture-meta.schema.json` |
| `audit.json` | `schemas/audit.schema.json` |
| `content.json` | `schemas/content.schema.json` |
| `design/build.json` | `schemas/design-build.schema.json` |
| `design/critic.json` | `schemas/critic.schema.json` |

- `schema_version: "1.0"` обязателен
- `additionalProperties: false` (кроме `lead.raw`)
- `brand_hints` / `brand_tokens` **не** в `capture/meta.json` на M1 — только в `design/build.json` (milestone 3)

## Статусы стадий

`pending | running | done | skipped | failed`

### Инициализация по ветке

| Стадия | `has_website` | `no_website` |
|--------|---------------|--------------|
| capture | pending | skipped |
| research | skipped | pending |
| audit | pending | skipped |
| copy, design, publish, offer | pending | pending |

## Роутинг

- `decideBranch` и `probeSite` — только код (`fetch`), без LLM и Playwright
- Probe fail (DNS, non-200, парковка) → `no_website`, Capture **skipped**, G1 не вызывается
- Playwright — только в Capture и позже Publish/G5
- **Sticky branch (M1):** после первого `state.json` ветка не пересчитывается, пока URL сайта в лиде не изменился. Повторная проверка сайта — только при смене URL. При смене ветки сохраняем уже выполненные этапы, а не обнуляем всё состояние

## Идемпотентность

Skip стадии только если:

1. `status === done`
2. hash входов совпал
3. артефакт существует и проходит gate (capture — G1; audit — G2; copy — G3; design — G4)

После `failed` повторный запуск **не** skip. `--force` всегда перезапускает.

## Retry G1

1 первичный запуск + 2 retry = max `attempts=3`. При исчерпании — `failed` с непустым `error`:

```
lead_id=domeo stage=capture gate=G1 artifact=capture/desktop.png size=100 required>5120
```

## Gate G2 (Audit, M2)

После стадии Audit (`has_website`, capture `done`).

**Code checks:**
- `audit.json` валиден по схеме
- `lead_id` совпадает с лидом
- `findings.length >= 3`
- каждый `evidence` — путь под `capture/` (без `../`), файл существует (фрагмент `#Lnn` отбрасывается)

**Precondition:** `state.stages.capture.status === done`.

**A1 two-step seam:**
1. Cursor-агент пишет `audit.json` (vision + text + signals) по `agents/audit/PROMPT.md`
2. `npm run pipeline -- --lead leads/{id} --stage audit` — G2 + обновление `state.json`

**Exit codes (`--stage audit`):**
- `0` — done или idempotent skip или audit skipped (`no_website`)
- `1` — failed (capture not done, G2 fail)
- `3` — `audit.json` отсутствует, `audit.status=pending` (awaiting agent)

**Идемпотентность audit:** hash стадии = **hash capture** (`state.stages.capture.hash`), не hash `audit.json`. Skip только если `audit.status=done`, hash совпал с capture и G2 pass (`auditArtifactIsValid`).

**Capture invalidation:** если capture перезапущен с новым hash — audit сбрасывается в `pending` (очищаются hash, artifact, error).

**Retry A1:** без auto-retry цикла в коде; каждый CLI-вызов при G2 fail увеличивает `attempts`. Исправление = агент правит `audit.json` + повтор CLI.

## Gate G3 (Copy, M3)

После Copy. Precondition: `audit.status === done` (`has_website`) или `research.status === done` (`no_website`).

**Code checks:** schema; hero+contact CTA; benefits ≥3; social_proof не пуст; Russian heuristic; vertical non-empty.

**A1:** агент пишет `content.json` → `npm run pipeline -- --lead … --stage copy`. Exit `3` = awaiting content.json. Max attempts `G3_MAX_ATTEMPTS=2`.

**Hash:** `copy.hash` = upstream (`audit.hash` или `research.hash`). Успешный copy → invalidate design.

## Gate G4 (Design + Design-Critic, M3)

После Design. Precondition: `copy.status === done`.

**Flow:**
1. `--stage design` → code `assembleDesign` (`src/steps/design/assemble.ts`) собирает `design/dist/` + `build.json` из `context/design-system` + `content.json` + capture assets + `resolveBrandTokens`
2. Orchestrator **всегда** `renderPreview` → G4 code checks; если нет `critic.json` → exit **3** awaiting critic
3. Design-Critic пишет `design/critic.json` → `--stage design` → full G4
4. После critic fail: Design agent правит входы/tokens и перезапускает сборку (polish/retry) — не рисует сайт free-form

**Code checks:** `index.html`; `build.json` schema; no leftover `{{`; no Google Fonts CDN; `brand_tokens.logo` exists under dist if set; `img` asset srcs exist; CSS has `prefers-reduced-motion`; previews >5KB; `console_errors_count=0`; `overflow_mobile !== true`.

**Critic:** schema; `pass=true`; scores trust/modern/sellable/readable все ≥4.

**Hash:** `design.hash` = `copy.hash`. Template id from vertical (default `renovation-v1`). Assembly = **code** via `assembleDesign`; Design agent = polish/retry after critic fail.

**Premium:** aesthetic constraints via design-system + skill `premium-website-designer` → `static-assembly.md` (не Next). Orchestrator owns assembly + Playwright previews.

## Минимальный контекст между стадиями

Агент читает только свой input-контракт, пишет только свой output. Без сырого HTML в JSON.

## Ограничения M1 (принятые риски)

Это **не баги** и **не задачи на сейчас**. Так устроен первый этап (Foundation): быстро и дёшево проверить «есть ли нормальный сайт», а потом уже снимать скрины в браузере. Ниже — что может пойти не так и что с этим делать.

### R1. Две разные проверки сайта: «лёгкая» и «полная»

**Как работает:** сначала система дергает сайт простым HTTP-запросом (как curl — без картинок и без JavaScript). Если ответ похож на живой сайт, лид идёт в ветку «сайт есть». Потом уже открывается настоящий Chrome и делаются скрины, текст, логотип.

**Почему так:** проверка без браузера — секунды и ноль лишних ресурсов. Скрины без браузера не сделать.

**Что может случиться:**
- Лёгкая проверка говорит «сайт есть», а браузер получает блокировку, капчу или ошибку — capture не проходит.
- Реже наоборот: лёгкая проверка не успела или упала по таймауту, хотя сайт живой.

**Что делать:** если capture упал, а сайт реально рабочий — перезапустить с `--force`. Ветку «сайт есть / нет» мы **не переключаем** автоматически при каждом сбое (чтобы не терять уже сделанную работу).

**Когда пересмотрим:** на этапе Audit, если понадобится сверять «что видела лёгкая проверка» и «что увидел браузер».

---

### R2. Иногда «заглушка» путается с настоящим бизнесом

**Как работает:** если в адресе или на странице признаки парковки («домен продаётся», «parked», «скоро откроется» на пустой странице), лид считается **без сайта** — capture не запускается.

**Почему не идеально:** без «умного» анализа текста нельзя на 100% отличить парковку от маленького сайта с текстом «Скоро откроемся — мы реальная компания».

**Что может случиться:** редкий одностраничник с «скоро откроется» в заголовке вкладки попадёт в «нет сайта», хотя это живой бизнес.

**Что делать:** если знаете, что сайт живой — поправить URL в лиде или позже добавить ручной override (не в M1).

**Когда пересмотрим:** по накопленным кейсам из batch-импорта лидов.

---

### R3. Скорость загрузки (LCP) пока не меряем

**Как работает:** в метаданных capture есть место под «сколько миллисекунд грузилась главная картинка», но на M1 это **не заполняется**.

**Почему так:** первый этап — «собрать скрины и текст и пройти проверку качества», а не аудит производительности. Скорость нужна позже для отчёта клиенту и Lighthouse.

**Когда пересмотрим:** Audit или этап Publish (G5).

---

### R4. Страница не ждёт «полной тишины в сети»

**Как работает:** браузер считает страницу загруженной, когда подтянулся основной HTML и базовые ресурсы, прокручивает её и делает скрин. **Не** ждёт, пока все фоновые запросы и виджеты успокоятся — так надёжнее на современных сайтах (режим «дождаться полной тишини в сети» часто зависает на чатах, аналитике и бесконечных подгрузках).

**Что может случиться:** на тяжёлых одностраничниках часть текста подгружается позже — capture может дать короткий текст, и проверка G1 честно завалит этап (мало символов). Это лучше, чем молча сохранить пустую «оболочку».

**Когда пересмотрим:** если на целевых нишах часто не хватает текста — добавим паузу после прокрутки, без перехода на «ждать тишину в сети».
