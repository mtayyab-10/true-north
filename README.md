# Tasdeeq — تصدیق

**Catch typing mistakes in ledger entries before they cost you.**

> *Tasdeeq* means *verification* in Urdu.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Model: Gemma 4 26B A4B IT](https://img.shields.io/badge/Model-Gemma%204%2026B-orange)](https://ai.google.dev/gemma)

---

## What it does

Small shop owners keep handwritten bills, ledgers and invoices, then retype the numbers into a spreadsheet. Typing mistakes and digit transpositions go unnoticed until they cause a loss.

**Tasdeeq** closes that gap:

1. Upload a photo of a bill, ledger or invoice (English or Urdu labels both work).
2. **Gemma 4** reads the image through the Gemini API and extracts structured line items, totals, dates and vendor info.
3. Plain code compares the extracted values against your typed entries using a swappable JSON rules file. The model never decides what is a mismatch — code does.
4. Each finding shows the field, your typed value, what the document says, the evidence, confidence and severity.
5. You resolve each finding: accept the document value, keep your typed value, or edit manually.
6. The export gate releases a verified CSV only when every finding is resolved. Unresolved findings block the release.
7. Gemma also writes a short plain-language summary of the findings, in English or Urdu on request.

---

## How to run

### Prerequisites

- Node.js 18 or later
- A [Gemini API key](https://aistudio.google.com/) (free tier works)

### Setup

```bash
git clone https://github.com/YOUR_USERNAME/tasdeeq.git
cd tasdeeq
npm install
```

Create `.env.local` in the project root:

```
gemini_api_key=YOUR_GEMINI_API_KEY_HERE
```

> ⚠ Never commit `.env.local`. It is in `.gitignore`.

### Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### No API key? Use demo mode

Click **"Load demo sample"** on the home page. This loads a pre-cached extraction of a sample invoice with two intentional errors, so you can see the full flow without a network call.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── extract/route.ts     ← POST: image → Gemma 4 → structured JSON
│   │   └── summarize/route.ts   ← POST: findings → Gemma 4 → plain text
│   ├── page.tsx                 ← Main UI (client component)
│   ├── layout.tsx
│   └── globals.css              ← Full custom design system (no CSS framework)
├── lib/
│   ├── types.ts                 ← Zod schemas + TypeScript types
│   ├── rules-engine.ts          ← Pure-code comparison logic, no AI
│   └── demo-cache.ts            ← Pre-cached extraction for offline demo
└── components/
    ├── Uploader.tsx
    ├── EntryTable.tsx
    ├── FindingsPanel.tsx
    └── ExportGate.tsx
data/
├── rules.json                   ← Swappable rules file (rule_id, field, check_type, severity)
└── php-versions.json            ← Roadmap: PHP CVE version table
demo-samples/                    ← Synthetic demo data and photo guide
```

### Key design decisions

| Concern | Decision |
|---|---|
| **Who decides mismatches?** | Code (`rules-engine.ts`), never the model |
| **Rules format** | One JSON file — swappable without touching code |
| **API key safety** | Key read only in Next.js server routes; never logged, never sent to the client |
| **Offline demo** | Pre-cached extraction in `demo-cache.ts`; no network needed |
| **JSON parsing** | Strip code fences → parse → Zod validate → retry once on failure |

---

## Model

**Gemma 4 26B A4B IT** (`gemma-4-26b-a4b-it`)

- Architecture: Mixture-of-Experts, ~26B total parameters, ~4B active per token
- Context window: 256K tokens
- Modalities: Text + Image (native multimodal)
- License: [Apache 2.0](https://ai.google.dev/gemma/terms) — see [official model card](https://ai.google.dev/gemma/docs/model_card_4)
- Accessed via: [Gemini API](https://ai.google.dev) (Google AI Studio)

Gemma is central to this project: without its multimodal image-reading capability, extracting structured data from handwritten and printed paper records would not be possible. The model reads the document; code does all the checking.

---

## Privacy

- Uploaded images are sent to the Gemini API for extraction.
- Nothing is stored on any server. There is no database, no login, no session persistence.
- The API key is read only on the server side and never exposed to the browser.

---

## Rules file

`data/rules.json` contains a list of rules. Each rule has:

| Field | Meaning |
|---|---|
| `rule_id` | Unique identifier (e.g. `R001`) |
| `field` | Which field to check (e.g. `total_amount`) |
| `check_type` | `equals`, `equals_ci`, `within_tolerance`, `sum_matches` |
| `tolerance` | Numeric tolerance for `within_tolerance` / `sum_matches` |
| `severity` | `high`, `medium`, or `low` |

Swap the file to change the rules — no code change needed.

---

## Key dependencies

| Package | Version | Purpose |
|---|---|---|
| `next` | 15.x | App framework (App Router) |
| `@google/genai` | 2.x | Official Google GenAI JavaScript SDK |
| `zod` | 3.x | Runtime schema validation |
| `typescript` | 5.x | Type safety |

---

## What's next (roadmap)

- PHP version checker (stretch goal): upload a hosting panel screenshot → Gemma extracts the PHP version → code compares against patched versions for CVE-2026-109618 and CVE-2026-109619 → explains next steps in plain language.
- Multi-page ledger support (batch images)
- Urdu OCR improvement via prompt tuning
- CSV import for typed entries (alongside the editable table)

---

## Submission

**Event:** Hacktoberfest Hack Day Faisalabad 2026  
**Challenges:** Best Open-Source AI Project · Best Use of Gemma 4  
**Team:** Tayyab

## License

This project is licensed under the [MIT License](LICENSE).  
Gemma 4 model is licensed under [Apache 2.0](https://ai.google.dev/gemma/terms).
