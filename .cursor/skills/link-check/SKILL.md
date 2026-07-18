---
name: link-check
description: Resolve and verify all Offer links return HTTP 200 for Gate G6 code checks — demo_url from deploy.json, portfolio from context, audit_pdf if present; also why_this_company and message length. Use this skill when implementing runGateG6 link checks in src/gates/g6Offer.ts, debugging G6 failures, or verifying offer.json links before sending to client. Also use when the user mentions link-check, broken demo link, portfolio URL 404, or G6 before Offer completes. Do NOT use for full demo smoke with Lighthouse (smoke-test-url), writing offer text (agent-offer), generating audit.pdf (generate-audit-pdf S14), or G6 tone-check LLM.
---

# Link Check

Gate G6 **code checks** — URL resolution and offer field presence.

## When to use

- After Offer agent writes `offer.json` + `offer.md`.
- Implementing link resolution in `src/gates/g6Offer.ts` or `src/lib/linkCheck.ts`.
- Debugging G6 fail — broken demo, portfolio, or audit_pdf link.
- User asks to verify all links in offer resolve before send.

**Not for:** Lighthouse / console smoke on demo (`smoke-test-url`). Not for writing offer copy (`25-agent-offer` / Offer agent). Not for G6 tone lint (`offerToneLint` in gate). Not for generating `audit.pdf` (`generate-audit-pdf`, S14).

## Related rules

- [03-pipeline-gates.mdc](../../rules/03-pipeline-gates.mdc) — G6 policy, retry 2× offer
- [25-agent-offer.mdc](../../rules/25-agent-offer.mdc) — link sources, `why_this_company`, length limit

## Prerequisites

- `leads/{lead_id}/offer/offer.json` exists.
- `deploy.json` with real `demo_url` (G5 passed).
- `context/portfolio.json` for portfolio link(s).
- Optional `offer/audit.pdf` if `links.audit_pdf` referenced.
- `fetch` available (Node 18+); timeout per URL (~10s).
- `src/` may be absent — spec-first.

## Procedure

### 1. Collect URLs to check

Build list from artifacts (no placeholders):

| Link key | Source |
|----------|--------|
| `demo` | `deploy.json.demo_url` — must match `offer.json.links.demo` |
| `portfolio` | `context/portfolio.json` URL(s) referenced in offer |
| `audit_pdf` | `leads/{id}/offer/audit.pdf` if link present (local file → optional HTTP if hosted) |

Reject `example.com`, empty strings, invented URLs.

### 2. HTTP resolution check

For each **external** HTTPS URL:

```typescript
async function checkUrl(url: string): Promise<{ ok: boolean; status?: number }> {
  const res = await fetch(url, {
    method: 'HEAD',
    signal: AbortSignal.timeout(10_000),
    redirect: 'follow',
  }).catch(() => null);
  if (!res) return { ok: false };
  if (res.status === 405) {
    // fallback GET for servers that reject HEAD
    const getRes = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(10_000) });
    return { ok: getRes.status === 200, status: getRes.status };
  }
  return { ok: res.status === 200, status: res.status };
}
```

For **local** `audit.pdf`: verify file exists under `leads/{id}/offer/audit.pdf`.

On fail: `lead_id=domeo stage=offer gate=G6 link=demo url=https://... status=404`.

### 3. Code check — `why_this_company`

From `offer.json`:

```
offer.why_this_company` present and non-empty string
```

Per `25-agent-offer` — mandatory personalization field.

### 4. Code check — message length

From `offer.json` or `offer.md`:

```
message.length <= 1500  // or limit from context/pricing config
```

On fail: include actual length in error.

### 5. Return GateResult

```typescript
{
  pass: allLinksOk && whyPresent && lengthOk,
  gate: 'G6',
  errors: [...]
}
```

Read-only — do not edit `offer.json` to fix links.

### 6. G6 tone (M5 status)

PRD §14 allows LLM tone-check. **M5 stand-in:** code lint in `src/gates/offerToneLint.ts` (called from `runGateG6`), same class as G2 `lintAuditClientText`. No LLM API in Node for tone.

This skill does **not** implement tone — only link/field code checks via `checkOfferLinks`.

### 7. Orchestrator integration

- On code fail: retry Offer 2×, then `offer.status: failed`.
- On code pass + tone pass: `offer.status: done`; pipeline complete.
- Never skip because offer «looks fine» (`EXAMPLES-leadgenerator`).

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `offer.json`, `deploy.json`, `context/portfolio.json` | `GateResult` `gate: 'G6'` |
| Optional `offer/audit.pdf` | File existence or URL 200 |

**Code owner (implemented M5):** `src/gates/g6Offer.ts` (`runGateG6`), `src/lib/linkCheck.ts` (`checkOfferLinks`)  
**Stage:** Offer → Gate G6

## Verification

| Check | Status |
|-------|--------|
| demo link from deploy.json only | implemented — `linkCheck.test.ts`, `g6Offer.test.ts` (mock fetch) |
| portfolio link 200 | implemented — `checkOfferLinks` + G6 tests (mock HTTP) |
| placeholder URLs rejected | implemented — `isPlaceholderUrl` / `linkCheck.test.ts` |
| `why_this_company` enforced | implemented — `runGateG6` + `g6Offer.test.ts` |
| message length ≤1500 | implemented — schema `maxLength` + G6 |
| local `offer/audit.pdf` when linked | implemented — existsSync path in `checkOfferLinks` |
| `quick_validate.py` | run after write |

## Test prompts

1. «Проверь G6 link-check для leads/domeo — demo, portfolio, audit_pdf все 200, why_this_company на месте»
2. «Offer с demo_url example.com для теста» (must refuse — real deploy.json only)
3. «Пропусти gate G6, оффер готов» (must refuse — 03-pipeline-gates)

## Forbidden

- Do not use placeholder or invented URLs (`25-agent-offer`, EXAMPLES).
- Do not skip link check because message looks ready.
- Do not implement G6 tone-check LLM in this skill (M5 tone = `offerToneLint` in gate, not here).
- Do not generate `audit.pdf` — `generate-audit-pdf` (S14).
- Do not run Lighthouse/console smoke — `smoke-test-url` (S10).
- Do not mutate `offer.json` inside link-check — return errors to orchestrator.
- Do not set `offer.status: done` from link-check module.
