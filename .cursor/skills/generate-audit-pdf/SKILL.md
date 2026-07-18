---
name: generate-audit-pdf
description: Generate client-facing audit.pdf from audit.json findings and money_loss_summary for the offer package. Use this skill when implementing audit PDF export after Audit or before Offer, or creating missing offer/audit.pdf file on disk. Also use when the user mentions audit.pdf, PDF report for client, or printable audit from audit.json. Do NOT use for writing audit.json content (agent-audit), verifying audit_pdf URL or HTTP 200 (link-check S11), or inventing findings not in audit.json.
---

# Generate Audit PDF

Render `audit.json` into printable client PDF at `leads/{id}/offer/audit.pdf`.

## When to use

- After `audit.json` passes G2 (`gate-g2-audit-research`).
- Before or during Offer stage — PDF linked in `offer.json` / `offer.md`.
- User needs client-deliverable audit report (not just JSON).
- Implementing PDF step parallel to Offer assets (PRD §13 parallelism).

**Not for:** writing or rewriting `audit.json` (`agents/audit/`). Not for HTTP link verification (`link-check`). Not for `research.json` branch unless product extends PDF to research (default: `audit.json` only).

## Related rules

- [21-agent-audit.mdc](../../rules/21-agent-audit.mdc) — audit facts source, optional `audit.pdf` deliverable
- [25-agent-offer.mdc](../../rules/25-agent-offer.mdc) — `links.audit_pdf`, offer package
- [02-llm-invariants.mdc](../../rules/02-llm-invariants.mdc) — no new fabricated claims in PDF

## Prerequisites

- `leads/{lead_id}/audit.json` exists and passed G2.
- `leads/{lead_id}/offer/` directory (create if missing).
- PDF generator: pinned **`pdfkit`** (+ `@types/pdfkit`) via `src/lib/auditPdf.ts` — **no** runtime `context/` generation.
- Cyrillic: `auditPdf.ts` registers `assets/fonts/DejaVuSans.ttf` with pdfkit.

## Procedure

### 1. Entry point

```typescript
export async function generateAuditPdf(leadDir: string): Promise<string>
```

Returns relative path `offer/audit.pdf`.

### 2. Read input (read-only)

Load `leads/{id}/audit.json` only:

- `business_facts`
- `findings[]` — `claim`, `evidence`, `impact`, `severity`
- `money_loss_summary`
- `tone` (for section headers style only)

Do **not** read `capture/*` for new claims — evidence paths may be cited as text references only (e.g. «см. скрин главной»), not embed full screenshots in v1 unless product specifies.

### 3. PDF content structure

Client-facing Russian report:

1. **Title** — company name from `lead.json` + «Аудит сайта»
2. **Резюме** — `money_loss_summary` verbatim from `audit.json`
3. **Ключевые проблемы** — each finding:
   - `claim`
   - `impact`
   - `severity` badge
   - Optional short evidence reference (path string, not fabricated detail)
4. **Факты о бизнесе** — `business_facts` section if present

No new metrics or percentages not in `audit.json` (`02-llm-invariants`).

### 4. Render PDF

1. Build layout (HTML template or programmatic PDF).
2. Write to `leads/{id}/offer/audit.pdf`.
3. Verify file exists and size > 0.

Optional: host copy for public URL — if so, URL must be real for G6; local file path suffices for `link-check` file existence check.

### 5. Wire into Offer

Per `25-agent-offer`:

- `offer.json.links.audit_pdf` — path or URL to generated PDF
- Offer agent reads `deploy.json`, `audit.json`, portfolio — PDF is **companion asset**

`link-check` (S11) verifies `audit_pdf` resolves when link present.

### 6. Parallelism (PRD §13)

May run **in parallel** with final smoke-test of links:

```
Offer stage: generate audit.pdf ∥ smoke-test-url on demo (if needed)
```

Orchestrator schedules; this skill does not run smoke or link-check.

### 7. Research branch

Default: **audit.json only**. `research.json` PDF variant is out of scope unless PRD/schema updated with user approval.

## Inputs / Outputs

| Input | Output |
|-------|--------|
| `audit.json` | `leads/{id}/offer/audit.pdf` |
| `lead.json` (name) | PDF title/header |

**Code owner (implemented M5):** `src/lib/auditPdf.ts` (`generateAuditPdf`) — called from `runOfferGate` before A1 await  
**Stage:** Offer (before G6); input `audit.json` only

## Verification

| Check | Status |
|-------|--------|
| PDF contains only audit.json facts | implemented — `generateAuditPdf` reads `audit.json` (+ `lead.json` name); unit coverage in `auditPdf.test.ts` |
| `offer/audit.pdf` exists after run | implemented — writes relative `offer/audit.pdf`, size > 0 asserted in tests |
| `link-check` passes on audit_pdf when linked | implemented — local existsSync in `checkOfferLinks` / G6 (no HTTP host required for local path) |
| Cyrillic / pdfkit wired | implemented — pdfkit + DejaVu font path in `auditPdf.ts` |
| `quick_validate.py` | run after write |

## Test prompts

1. «Сгенерируй audit.pdf из leads/domeo/audit.json в offer/ для клиентского пакета»
2. «Добавь в PDF выдуманный finding про 40% потерь» (must refuse — audit.json only)
3. «Проверь что audit_pdf ссылка открывается» (should use `link-check`, not this skill)

## Forbidden

- Do not invent findings, metrics, or claims not in `audit.json`.
- Do not rewrite `audit.json` during PDF generation.
- Do not use placeholder PDF or lorem ipsum client content.
- Do not verify HTTP links here — `link-check` (S11).
- Do not generate `context/` files at runtime.
- Do not run before G2 pass on `audit.json`.
- Do not embed English client text unless user requests.
