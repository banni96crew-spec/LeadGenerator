---
name: render-preview
description: Render design/dist static build to preview-desktop.png and preview-mobile.png with Playwright for G4 Design-Critic. Use this skill when implementing Design step preview generation, debugging missing preview PNGs before gate G4, or screenshotting built demo sites at 1440 and iPhone viewports. Also use when the user mentions design previews, preview-desktop.png, preview-mobile.png, or visual QA before Design-Critic. Do NOT use for capturing client original website (capture-website), Cloudflare deploy (deploy-cloudflare), or assembling design/dist from templates.
---

# Render Preview

Playwright render of built demo site to preview PNGs for G4.

## When to use

- After `design/dist/` static build exists.
- Before Design-Critic LLM runs (G4 requires previews — `03-pipeline-gates`).
- Implementing preview step in Design pipeline or `src/steps/` helper.
- User asks to generate/regenerate `design/preview-*.png`.

**Not for:** capturing live client site (`capture-website`). Not for publishing demo (`deploy-cloudflare`). Not for design template assembly (`23-agent-design`).

## Related rules

- [23-agent-design.mdc](../../rules/23-agent-design.mdc) — triggers preview generation
- [33-demo-site-output.mdc](../../rules/33-demo-site-output.mdc) — preview artifacts, G4 prerequisite
- [03-pipeline-gates.mdc](../../rules/03-pipeline-gates.mdc) — G4 code checks include previews rendered

## Prerequisites

- `leads/{lead_id}/design/dist/` exists with valid `index.html` (static site).
- `design/build.json` records `build_dir: "design/dist"`.
- Playwright chromium available.
- Local HTTP server or `file://` navigation strategy for static assets (prefer local server for correct relative paths).

## Procedure

### 1. Resolve build path

```
buildDir = leads/{lead_id}/design/dist/
outDir   = leads/{lead_id}/design/
```

Confirm `index.html` present. If missing — fail early; do not render empty previews.

### 2. Serve static build

Start ephemeral local server pointing at `buildDir` (recommended):

```typescript
// e.g. serve-handler, http-server, or minimal Node static server
const baseUrl = `http://127.0.0.1:${port}/`;
```

Using `file://` may break relative asset paths — prefer HTTP localhost.

### 3. Desktop preview

1. Browser context viewport **1440×900** (match capture desktop convention).
2. `page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30_000 })`.
3. Full-page screenshot → `design/preview-desktop.png`.

```typescript
await page.screenshot({ path: previewDesktopPath, fullPage: true });
```

### 4. Mobile preview

1. Context with `devices['iPhone 13']` (match capture mobile convention).
2. Same `baseUrl`, `networkidle`.
3. Full-page screenshot → `design/preview-mobile.png`.

### 5. Optional parallelism

Desktop and mobile renders may run in parallel (PRD §13) — separate contexts, same browser instance.

### 6. Update `design/build.json`

Set `screens` array:

```json
"screens": [
  "design/preview-desktop.png",
  "design/preview-mobile.png"
]
```

Validate via `validate-contract` / `design-build` schema when present.

### 7. Console error check (G4 code)

During render, collect `page.on('console')` for `error` type. Non-zero console errors fail G4 code check — report to orchestrator; do not mark Design done.

### 8. Handoff to Design-Critic

Previews are **read-only input** for `agents/design-critic/` — critic does not edit `design/dist/`.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `design/dist/` static build | `design/preview-desktop.png` |
| `build.json` `build_dir` | `design/preview-mobile.png` |
| | Updated `build.json` `screens[]` |

**Code owner (planned):** design step / Playwright helper  
**Stage:** Design (after build, before G4 critic)

## Verification

| Check | Status |
|-------|--------|
| Both preview PNGs exist and non-empty | not run |
| `build.json.screens` lists both paths | not run |
| No horizontal overflow on mobile viewport | not run |
| Console errors collected for G4 | not run |

## Test prompts

1. «Сгенерируй preview-desktop и preview-mobile для leads/domeo/design/dist»
2. «Пропусти preview PNGs и сразу запусти Design-Critic» (must refuse — G4 requires previews)
3. «Отрендери React SPA preview» (must refuse — static HTML only)

## Forbidden

- Do not skip preview generation before Design-Critic.
- Do not use React/Next/Vue SPA as demo output.
- Do not capture original client website here — `capture-website`.
- Do not hand-edit previews without re-running render after `design/dist/` changes.
- Do not deploy to Cloudflare in this step — `deploy-cloudflare`.
- Do not mutate `design/dist/` CSS — critic notes only; Design agent fixes.
