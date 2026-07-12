---
name: smoke-test-url
description: Smoke-test a deployed demo URL for Gate G5 — HTTP 200, Playwright console errors, optional Lighthouse performance; write results to deploy.json.checks. Use this skill after deploy-cloudflare when implementing src/steps/publish/smoke.ts, debugging G5 failures, or verifying demo_url before Offer. Also use when the user mentions smoke test, Lighthouse perf threshold, console errors on demo site, or deploy.json checks. Do NOT use for Cloudflare deploy (deploy-cloudflare), G1 capture file checks (gate-g1-capture), or setting publish.status done (run-pipeline-stage).
---

# Smoke Test URL

Post-deploy smoke test for Gate G5 — fills `deploy.json.checks`.

## When to use

- After `deploy-cloudflare` writes `demo_url` to `deploy.json` (checks initially `{}`).
- Implementing smoke helper in `src/steps/publish/smoke.ts` or `src/lib/smokeTest.ts`.
- Orchestrator runs smoke before evaluating G5 / setting `publish.status: done`.
- User asks to verify demo URL loads without console errors or meets Lighthouse threshold.
- Optional: pre-offer smoke on links (full link resolution is `link-check`).

**Not for:** deploying to Cloudflare (`deploy-cloudflare`). Not for capture screenshot checks (`gate-g1-capture`). Not for updating `state.json` (`run-pipeline-stage`). Not for G6 offer link batch (`link-check`).

## Related rules

- [03-pipeline-gates.mdc](../../rules/03-pipeline-gates.mdc) — G5 policy, re-deploy retry
- [15-publish-step.mdc](../../rules/15-publish-step.mdc) — post-deploy smoke, `deploy.json.checks`

## Prerequisites

- `leads/{lead_id}/deploy.json` exists with valid `demo_url` (HTTPS, no placeholders).
- `design/dist/` was deployed successfully (`deploy-cloudflare`).
- Playwright chromium for console-error check.
- Lighthouse CLI or CDP integration optional (threshold from config/env).
- `src/` may be absent — spec-first.
- Secrets stay in env — not in `deploy.json`.

## Procedure

### 1. Entry point

```typescript
export async function smokeTestUrl(
  url: string,
  leadDir: string
): Promise<SmokeResult>
```

Called by **orchestrator or publish step** after `runPublish()` from `deploy-cloudflare` — **not** inside `runGateG5`.

`runGateG5` is read-only: reads `deploy.json.checks` and returns `GateResult`. It does not run Playwright.

### 2. Input URL

Read `demo_url` from `leads/{id}/deploy.json`. Reject:

- Empty URL
- `example.com` or other placeholders
- Non-HTTPS in production config (unless local dev override)

### 3. Check — HTTP 200

```typescript
const res = await fetch(url, {
  method: 'GET',
  signal: AbortSignal.timeout(15_000),
  redirect: 'follow',
});
const http_200 = res.status === 200;
```

Record failure reason if not 200.

### 4. Check — Console errors (Playwright)

Unlike G1 gate modules, smoke test **uses browser** per PRD §12:

```typescript
const browser = await chromium.launch();
const page = await browser.newPage();
const consoleErrors: string[] = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') consoleErrors.push(msg.text());
});
await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
await browser.close();
const no_console_errors = consoleErrors.length === 0;
```

### 5. Check — Lighthouse performance (optional)

If enabled in project config:

- Run Lighthouse CLI against `demo_url`, or
- Use Playwright CDP + lighthouse library

Extract performance score (0–100). Compare to threshold (e.g. `LIGHTHOUSE_PERF_MIN=85` from env).

```typescript
const lighthouse_perf = score; // number
```

If Lighthouse skipped in milestone stub, omit or set `null` per schema allowance.

### 6. Write `deploy.json.checks`

Update `leads/{id}/deploy.json` (merge, do not wipe `demo_url`):

```json
{
  "schema_version": "1.0",
  "demo_url": "https://leadgenerator-demos.pages.dev/domeo",
  "checks": {
    "http_200": true,
    "no_console_errors": true,
    "lighthouse_perf": 96
  }
}
```

Validate full `deploy.json` via `validate-contract` when schema exists.

### 7. Return result for G5

```typescript
type SmokeResult = {
  pass: boolean;
  checks: { http_200: boolean; no_console_errors: boolean; lighthouse_perf?: number };
  errors: string[];
};
```

G5 gate (`03-pipeline-gates`) evaluates:

- `http_200 === true`
- `no_console_errors === true`
- `lighthouse_perf >= threshold` (if configured)

### 8. Orchestrator handoff

Per [`deploy-cloudflare`](../deploy-cloudflare/SKILL.md) and `run-pipeline-stage`:

1. S7 `runPublish()` writes `demo_url`, `checks: {}`
2. Orchestrator calls **this skill** (`smokeTestUrl`) — populates `deploy.json.checks`
3. Orchestrator calls `runGateG5` — read-only evaluation of `checks` → `GateResult`
4. On G5 pass: orchestrator sets `publish.status: done`

Sequence: **deploy → smoke (S10) → gate G5 (read checks) → state update**. Never embed Playwright in `src/gates/g5*.ts`.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `deploy.json` `demo_url` | Updated `deploy.json.checks` |
| Config threshold | `SmokeResult.pass` for G5 |

**Code owner (planned):** `src/steps/publish/smoke.ts` or `src/lib/smokeTest.ts`  
**Stage:** Publish → Gate G5 (after `deploy-cloudflare`)

## Verification

| Check | Status |
|-------|--------|
| `checks` populated after smoke | not run |
| HTTP non-200 fails smoke | not run |
| Console errors fail smoke | not run |
| Handoff consistent with S7 deploy skill | spec review |
| `quick_validate.py` | run after write |

## Test prompts

1. «После деплоя domeo прогони smoke на demo_url — HTTP 200, console errors, Lighthouse в deploy.json.checks»
2. «Задеплой dist на Cloudflare» (should trigger S7, not S10)
3. «Поставь publish.status done без smoke» (must refuse — orchestrator after G5)

## Forbidden

- Do not deploy static assets to Cloudflare — `deploy-cloudflare` (S7).
- Do not set `publish.status: done` inside smoke module — orchestrator after G5.
- Do not mutate `state.json` from smoke helper.
- Do not use placeholder URLs in checks.
- Do not skip smoke after deploy when G5 is required (`03-pipeline-gates`).
- Do not implement G1 filesystem screenshot checks here.
- Do not embed smoke/Playwright inside `runGateG5` — gate reads `deploy.json.checks` only.
