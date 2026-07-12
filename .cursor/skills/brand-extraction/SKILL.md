---
name: brand-extraction
description: Extract brand tokens (primary color, font hints, logo path) from captured website CSS and screenshots for design/build.json. Use this skill when implementing brand_tokens during Capture or Design build, mapping capture/logo.png to demo site styling, or debugging missing client branding in design/dist. Also use when the user mentions palette extraction, font detection from site, brand colors from CSS, or applying lead-specific tokens without hardcoding in context/design-system. Do NOT use for full demo assembly (agent-design), preview PNGs (render-preview), or editing shared design-system files with client logos.
---

# Brand Extraction

Derive per-lead `brand_tokens` from capture artifacts and page styles.

## When to use

- During or after `capture-website` — optional enrichment for Design.
- Design build step needs `brand_tokens` in `design/build.json`.
- User asks to pull brand colors/fonts from client site without hardcoding in `context/design-system/`.
- Debugging demo that ignores `capture/logo.png` or uses wrong primary color.

**Not for:** assembling HTML demo (`23-agent-design`). Not for preview screenshots (`render-preview`). Not for modifying shared `context/design-system/` with client assets.

## Related rules

- [14-capture-step.mdc](../../rules/14-capture-step.mdc) — `capture/logo.png`, capture assets
- [23-agent-design.mdc](../../rules/23-agent-design.mdc) — `brand_tokens` in `build.json`
- [31-design-system.mdc](../../rules/31-design-system.mdc) — defaults only; lead brand at build time

## Prerequisites

- `leads/{lead_id}/capture/` exists (from `has_website` branch).
- Prefer `capture/logo.png` when present; optional `capture/desktop.png` for color sampling.
- Access to page CSS during capture (computed styles / stylesheets) or saved token hints in `capture/meta.json` signals.
- `context/design-system/` provides **defaults** (`primary`, `font`) — overridden per lead at build.
- Milestone 3 — may run spec-first before Design stage code exists.

## Procedure

### 1. Inputs to read

| Source | Use |
|--------|-----|
| `capture/logo.png` | `brand_tokens.logo` path (relative) |
| `capture/desktop.png` | Dominant color sampling (optional fallback) |
| Page CSS / computed styles | `primary`, accent colors, `font-family` |
| `context/design-system/` defaults | Fallback when extraction weak |

Read only declared capture + design-system paths (`01-contract-first`).

### 2. Extract logo path

If `capture/logo.png` exists:

```json
"logo": "capture/logo.png"
```

Do not copy logo into `context/design-system/`. Reference relative path for Design assembly.

### 3. Extract primary color

Priority order:

1. CSS variables on `:root` (`--primary`, `--brand`, `--color-primary`).
2. Dominant color from header/nav computed `background-color` or `color`.
3. Sample from `capture/logo.png` or header region of `desktop.png` (deterministic color quantize — code only, no LLM).
4. Fallback: design-system default `primary`.

Normalize to hex string: `"#RRGGBB"`.

### 4. Extract font hint

1. `font-family` from `h1`, `body`, or CSS variables.
2. Strip fallbacks; keep first meaningful family name.
3. Fallback: design-system default `font`.

### 5. Build `brand_tokens` object

PRD §7.2 shape for `design/build.json`:

```json
{
  "brand_tokens": {
    "primary": "#1a4b8c",
    "font": "Inter, system-ui, sans-serif",
    "logo": "capture/logo.png"
  }
}
```

Omit `logo` key if file absent. Record extraction source in build metadata if helpful (optional field per schema when present).

### 6. Apply at build time (Design)

Design agent / build step:

1. Inject `brand_tokens` into CSS variables in `design/dist/` (e.g. `--color-primary`).
2. Use `logo` path in template hero/header.
3. Write `design/build.json` with `template`, `build_dir`, `screens`, `brand_tokens`.
4. Validate `design-build` schema via `validate-contract`.

### 7. Capture-stage vs Design-stage

- **Capture:** may store raw hints in signals or sidecar JSON if schema allows (future).
- **Design:** final `brand_tokens` in `build.json` is authoritative for demo + G4.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `capture/logo.png`, CSS, screenshots | `brand_tokens` object |
| design-system defaults | Fallback values |
| | Written into `design/build.json` at Design build |

**Code owner (planned):** capture modules + design build step  
**Stage:** Capture (optional hints), Design (authoritative tokens)

## Verification

| Check | Status |
|-------|--------|
| `capture/logo.png` reused when exists | not run |
| No client logo in `context/design-system/` | not run |
| `build.json` contains `brand_tokens` | not run |
| `design-build` schema validates | not run |

## Test prompts

1. «Извлеки primary и font из capture для domeo и запиши в build.json brand_tokens»
2. «Захардкодь логотип клиента в context/design-system» (must refuse)
3. «Сгенерируй уникальный CSS с нуля для бренда» (must refuse — design-system + vertical)

## Forbidden

- Do not embed lead-specific logos or colors in shared `context/design-system/` files.
- Do not use LLM to guess brand values without capture evidence.
- Do not use stock/placeholder logo when `capture/logo.png` exists.
- Do not generate or overwrite `context/` at runtime per lead.
- Do not build full `design/dist/` here — Design agent + `render-preview`.
- Do not use React/Next for token application — static HTML/CSS only.
