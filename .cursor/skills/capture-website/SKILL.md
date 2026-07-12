---
name: capture-website
description: Capture a lead website with Playwright — desktop/mobile screenshots, extracted text, logo/photos, signals, and capture/meta.json. Use this skill whenever implementing or running the Capture step, debugging G1 capture failures, taking pipeline screenshots for audit evidence, or working in src/steps/capture/. Also use when the user mentions Playwright capture, desktop.png, mobile.png, capture/text.txt, or website signals (CTA, mobile_friendly, tech). Never use for branch routing or HTTP probe without browser — that is probe-site. Never use LLM for extraction.
---

# Capture Website

Playwright-based website capture for the `has_website` branch.

## When to use

- Implementing or running `runCapture()` in `src/steps/capture/`.
- User asks to capture a lead site, fix capture artifacts, or debug G1 screenshot/text failures.
- Audit needs fresh `capture/desktop.png`, `capture/mobile.png`, `capture/text.txt`.
- After orchestrator sets `branch: has_website` (routing is **not** this skill — see `probe-site`).

**Not for:** `no_website` branch (orchestrator skips capture). Not for schema-only validation (`validate-contract`). Not for G1 gate tech checks (`gate-g1-capture`).

## Related rules

- [14-capture-step.mdc](../../rules/14-capture-step.mdc) — module layout, viewport, signals, outputs
- [01-contract-first.mdc](../../rules/01-contract-first.mdc) — paths, validate before return
- [02-llm-invariants.mdc](../../rules/02-llm-invariants.mdc) — no LLM in capture

## Prerequisites

- `leads/{lead_id}/lead.json` exists with valid `site` URL.
- `branch === has_website` (set by orchestrator after `probe-site`).
- Playwright chromium installed (`npx playwright install chromium` when `src/` exists).
- Lead directory writable: `leads/{lead_id}/capture/`.
- `validate-contract` skill available for `meta.json` validation before return.

## Procedure

### 1. Entry point

`runCapture(lead, leadDir): Promise<string>` in `src/steps/capture/index.ts` — returns relative path `capture/meta.json`.

Planned modules:

- `screenshots.ts` — desktop + mobile PNG
- `extract.ts` — text + signals
- `assets.ts` — logo + photos

### 2. Launch browser (one instance per run)

```typescript
const browser = await chromium.launch();
```

Reuse the same browser for desktop context, mobile context, and asset downloads. Do not launch separate browsers per screenshot.

### 3. Navigate

```typescript
await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
```

Record `http_status` from response for `meta.json`. On navigation failure: write partial meta with status, then throw/return error for orchestrator retry (G1: 2× capture).

### 4. Cookie banners (best-effort)

Click common consent selectors (`[id*="cookie"]`, `.cookie-accept`, `button:has-text("Accept")`). Do not fail capture solely because a banner remains.

### 5. Screenshots (`screenshots.ts`)

| Viewport | Settings | Output |
|----------|----------|--------|
| Desktop | 1440×900 | `capture/desktop.png` full-page |
| Mobile | `devices['iPhone 13']` | `capture/mobile.png` full-page |

```typescript
await page.screenshot({ path: desktopPath, fullPage: true });
```

### 6. Extract text and signals (`extract.ts`)

- `document.body.innerText` → `capture/text.txt` (no raw HTML file).
- Populate `signals` in meta:
  - `https` — URL scheme
  - `mobile_friendly` — viewport meta present
  - `has_form` — form elements on page
  - `has_cta` — action keywords RU/EN (заказать, записаться, contact, buy, …)
  - `tech` — generator meta / Tilda / Wix markers
  - `title`, `description` from document/meta
  - `lcp_ms` — optional if measurable

Detection is **code/DOM only** — no LLM.

### 7. Assets (`assets.ts`)

- Logo: `img` with `logo` in `src` or `alt`, else first header image → `capture/logo.png` (optional).
- Up to N photos → `capture/photos/*` (optional).

### 8. Write `capture/meta.json`

Relative paths only. Include `schema_version: "1.0"`, `url`, `http_status`, `screenshots`, `extracted_text`, `assets`, `signals`.

Example shape (PRD §7.2):

```json
{
  "schema_version": "1.0",
  "url": "https://example.ru",
  "http_status": 200,
  "screenshots": {
    "desktop": "capture/desktop.png",
    "mobile": "capture/mobile.png"
  },
  "extracted_text": "capture/text.txt",
  "assets": { "logo": "capture/logo.png", "photos": [] },
  "signals": { "https": true, "mobile_friendly": false, "has_cta": false, "has_form": true, "tech": "custom" }
}
```

### 9. Validate and return

1. Run `assertValid(meta, 'capture-meta')` via `validate-contract` / `src/gates/validate.ts`.
2. Return `capture/meta.json` path.
3. Orchestrator sets `capture.cost: 0`, runs G1 (`gate-g1-capture`).

### 10. Parallelism (optional)

Within one capture run, desktop screenshot ∥ mobile screenshot ∥ text extraction ∥ asset download is allowed (PRD §13).

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `lead.json` (`site` URL) | `capture/desktop.png`, `capture/mobile.png` |
| `leadDir` = `leads/{lead_id}/` | `capture/text.txt` |
| | `capture/meta.json` (+ optional logo/photos) |

**Code owner (planned):** `src/steps/capture/`  
**Stage:** Capture (after `has_website` routing)

## Verification

| Check | Status |
|-------|--------|
| Desktop/mobile PNG non-empty on live site | not run |
| `text.txt` ≥ 200 chars on typical business site | not run |
| `meta.json` passes `capture-meta` schema | not run |
| No HTML files in `capture/` | not run |
| `npm run pipeline` smoke | not run (no `src/`) |

## Test prompts

1. «Реализуй `runCapture` в src/steps/capture — скрины desktop 1440 и mobile iPhone 13 для leads/domeo»
2. «Capture падает на cookie banner — что делать по процедуре?»
3. «Добавь LLM для извлечения signals из HTML» (should refuse — point to Forbidden)

## Forbidden

- Do not use LLM for extraction, signals, or asset detection.
- Do not write raw HTML to `leads/{lead_id}/capture/`.
- Do not use absolute paths in `meta.json`.
- Do not launch a new browser per screenshot.
- Do not run capture when `branch === no_website` (orchestrator responsibility).
- Do not implement G1 checks (file size, min text length) here — gate module S8.
- Do not probe/route site availability — `probe-site` skill.
