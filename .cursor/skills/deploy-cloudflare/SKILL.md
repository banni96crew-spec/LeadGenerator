---
name: deploy-cloudflare
description: Deploy leads/{id}/design/dist static build to Cloudflare Pages and write deploy.json with demo_url and G5 checks. Use this skill when implementing src/steps/publish/, running Publish stage, debugging demo_url, or configuring CLOUDFLARE_API_TOKEN deploy. Also use when the user mentions Cloudflare Pages, wrangler pages deploy, deploy.json, or publishing the demo site after Design. Do NOT use for preview screenshots (render-preview), full pipeline CLI (run-pipeline-stage), or detailed G5 Lighthouse smoke (smoke-test-url Level 2) — though deploy must record check results.
---

# Deploy Cloudflare

Publish static demo build to Cloudflare Pages.

## When to use

- Implementing `runPublish()` in `src/steps/publish/`.
- Publish stage after G4 pass and valid `design/dist/`.
- User needs `demo_url` in `deploy.json` for Offer stage.
- Debugging failed deploy or missing `demo_url`.

**Not for:** building design (`23-agent-design`). Not for preview PNGs (`render-preview`). Not for orchestrator CLI flow (`run-pipeline-stage`). Detailed post-deploy smoke/Lighthouse procedures: `smoke-test-url` (S10) — this skill deploys and records `checks` placeholder/results.

## Related rules

- [15-publish-step.mdc](../../rules/15-publish-step.mdc) — `runPublish`, `deploy.json`, secrets, G5
- [03-pipeline-gates.mdc](../../rules/03-pipeline-gates.mdc) — G5 policy (reference only)
- [02-llm-invariants.mdc](../../rules/02-llm-invariants.mdc) — deploy is code, not LLM

## Prerequisites

- `leads/{lead_id}/design/dist/` exists and is non-empty static site.
- G4 passed (build + previews) before Publish runs.
- Environment variables (never commit):
  - `CLOUDFLARE_API_TOKEN`
  - `CLOUDFLARE_ACCOUNT_ID`
  - `CLOUDFLARE_PAGES_PROJECT` (or project name per config)
- Wrangler CLI or Cloudflare Pages API access.
- Milestone 4 — stub OK in earlier milestones; procedure is spec-first until `src/steps/publish/` exists.

## Procedure

### 1. Entry point

`runPublish(leadDir, buildDir): Promise<string>` in `src/steps/publish/index.ts` — returns path `deploy.json`.

```
buildDir = leads/{lead_id}/design/dist/
leadDir  = leads/{lead_id}/
```

Abort if `buildDir` missing or has no `index.html`.

### 2. Authenticate

Load credentials from environment only:

```bash
# Never store in repo, lead artifacts, or state.json
CLOUDFLARE_API_TOKEN=...
CLOUDFLARE_ACCOUNT_ID=...
```

### 3. Deploy static assets

**Option A — Wrangler CLI (recommended):**

```bash
npx wrangler pages deploy design/dist \
  --project-name="$CLOUDFLARE_PAGES_PROJECT" \
  --branch=main
```

Deploy from `leads/{lead_id}/` working directory or pass absolute dist path via `src/lib/paths.ts` helpers.

**Option B — Pages Direct Upload API:**

Use Cloudflare API with token; upload `design/dist` bundle; obtain deployment URL.

### 4. Resolve `demo_url`

After successful deploy, capture public URL (e.g. `https://{project}.pages.dev` or `https://{project}.pages.dev/{lead_id}` if using subpaths per PRD §17).

Write canonical `demo_url` — no placeholders like `example.com`.

### 5. Write `deploy.json`

PRD §7.2 shape (initial write after deploy):

```json
{
  "schema_version": "1.0",
  "demo_url": "https://domeo-demo.pages.dev",
  "checks": {}
}
```

Validate with `validate-contract` / `deploy` schema when present.

Populate `checks` only after `smoke-test-url` (S10, Level 2) runs — not in this skill.

### 6. Handoff to smoke-test-url (G5)

This skill ends after deploy + `demo_url` written.

G5 smoke (HTTP 200, Playwright console errors, Lighthouse) is **S10 `smoke-test-url`** — Level 2, not S7:

1. Orchestrator invokes `smoke-test-url` against `demo_url`.
2. S10 populates `deploy.json.checks` (`http_200`, `lighthouse_perf`, `no_console_errors`).
3. G5 gate evaluates checks; orchestrator updates `state.json` (`run-pipeline-stage`).

Reference G5 retry policy via `03-pipeline-gates` — do not duplicate full gate table here.

### 7. State updates (orchestrator only)

`run-pipeline-stage` / orchestrator sets `publish.status`, `artifact`, `cost` **after G5 pass** — not inside `runPublish()`. On deploy failure before smoke: return error with `lead_id`, stage `publish`, artifact path.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `design/dist/` | `deploy.json` |
| Cloudflare env vars | `demo_url` (public HTTPS) |
| G5 smoke results | `deploy.json.checks` (via S10 `smoke-test-url`, not this skill) |

**Code owner (planned):** `src/steps/publish/`  
**Stage:** Publish (after Design G4)

## Verification

| Check | Status |
|-------|--------|
| `deploy.json` validates against schema | not run |
| `demo_url` returns HTTP 200 | not run |
| No secrets in repo or artifacts | not run |
| G5 recorded before `publish.status = done` | not run (orchestrator + S10) |

## Test prompts

1. «Задеплой leads/domeo/design/dist на Cloudflare Pages и запиши deploy.json»
2. «Publish с demo_url example.com для теста» (must refuse — real URL only)
3. «Используй LLM чтобы выбрать хостинг» (must refuse — code only)

## Forbidden

- Do not deploy without valid `design/dist/`.
- Do not hardcode API tokens or account IDs in source or artifacts.
- Do not use LLM for deploy decisions.
- Do not implement HTTP 200, Lighthouse, or console-error smoke here — use `smoke-test-url` (S10, Level 2).
- Do not set `publish.status: done` in publish step — orchestrator after G5 pass.
- Do not skip G5 smoke after deploy (`03-pipeline-gates`) — orchestrator runs S10, not this skill.
- Do not write placeholder URLs in `offer.json` or `deploy.json`.
- Do not implement full Publish in Foundation milestone — stub until milestone 4.
- Do not commit `.env` or secrets to `leads/` artifacts.
