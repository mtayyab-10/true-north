# TrueNorth

**Context-Aware Data Quality & Pre-Submission Verification System**

> *Catch the wrong number before it is saved.* A pre-submission quality gate before the database that checks context, provides evidence, and gives analysts a clear decision before data is accepted.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Model: Gemma 4 26B A4B IT](https://img.shields.io/badge/Model-Gemma%204%2026B-orange)](https://ai.google.dev/gemma)
[![Platform: Web + Extension](https://img.shields.io/badge/Platform-Web%20%2B%20Browser%20Extension-blueviolet)](#)
[![Stack: Next.js 15 + TypeScript](https://img.shields.io/badge/Stack-Next.js%2015%20%7C%20TypeScript-black)](#)

---

## The Product Vision & Core Principle

**TrueNorth** is an intelligent, context-aware pre-submission quality gate engineered to identify suspicious, inconsistent, incorrect, or insufficiently supported data before it is committed to downstream accounting, ERP, or ledger systems.

Inspired by industrial *Poka-Yoke* (mistake-proofing) principles, TrueNorth catches clerical blunders, arithmetic mismatches, digit transpositions, and contextual outliers directly at entry time — in the web workspace and across third-party web forms via its browser extension.

### Core Architecture Principle

> **Ordinary code for certainty. Statistics for signals. An agent for context. Human review for accountability.**

TrueNorth separates verification into four distinct categories:
1. **Rule Violations (Deterministic Code)**: Checks proving a strict rule has failed (e.g. arithmetic mismatches like `qty × unit_price ≠ total`, missing mandatory fields, negative amounts, future dates).
2. **Contextual Suspicions (Statistical & Agent Signals)**: AI and statistical signals highlighting domain anomalies that warrant human review (e.g., commodity unit prices 10x higher than market benchmarks, mismatched vendor classifications).
3. **Uncertain Extractions (Visual Confidence)**: Low-confidence OCR or illegible handwritten/scanned receipt values flagged for analyst confirmation.
4. **Missing Context (Information Gaps)**: Data that cannot be responsibly verified without prerequisite parameters (e.g. unspecified currency or missing tax exemption justifications).

---

## Two Complementary Interfaces, One Unified Engine

TrueNorth provides two synchronized interfaces powered by the same backend verification engine (`/api/verify`):

### 1. Main Web Workspace (`/`)
- Enter entries manually or upload document photos/invoices.
- Configure business context (business domain, currency, reporting period, variance tolerance).
- Run the unified verification pipeline combining deterministic math rules, benchmark statistics, and Gemma 4 contextual reasoning.
- Interactive findings review with visual evidence, explanations, and suggested actions (e.g. 1-click adopt document value).
- Human review accountability: correct values, accept legitimate exceptions with required business justifications, or dismiss with audit notes.
- Strict **Quality Gate**: Prevents release while blocking errors remain. Generates cryptographically verified release certificates (`/api/release`) with full audit history export (JSON & CSV).

### 2. Browser Extension (`extension/`)
- Manifest V3 extension compatible with Chromium browsers (Google Chrome & Microsoft Edge).
- Automatically inspects input fields, selects, and labels on active web forms.
- Runs verification against the shared TrueNorth engine.
- Highlights flagged fields directly on the page DOM (glowing red outline for blocking errors, amber for suspicions, with floating tooltips).
- **Pre-Submission Guard**: Intercepts form submissions if unresolved blocking discrepancies exist, halting erroneous data release before external databases are updated.
- Quick in-popup exception review or one-click session transfer into the full Web Workspace (`?session=TN-...`).

### 3. Controlled Demonstration Form (`/demo-form`)
- Realistic supplier payable and expense ingestion portal.
- Pre-loaded with one-click clean and flawed datasets (arithmetic errors, digit transpositions, price outliers).
- Built-in live testing ground for both in-page Pre-Submission Guarding and the TrueNorth Browser Extension.

---

## Architecture Overview

```
truenorth/
├── extension/                     ← Chromium Manifest V3 Browser Extension
│   ├── manifest.json              ← MV3 manifest with activeTab & scripting
│   ├── content.js                 ← Form field discovery, DOM highlighting, pre-submission guard
│   ├── content.css                ← In-page glow borders and badge styles
│   ├── popup.html / popup.js      ← In-workflow extension UI & verification trigger
│   └── icons/                     ← 16px, 48px, 128px PNG icons
│
├── src/
│   ├── app/
│   │   ├── page.tsx               ← Main Web Workspace UI (Poka-Yoke layout)
│   │   ├── demo-form/page.tsx     ← Controlled Demo Form & Pre-Submission Guard
│   │   ├── api/
│   │   │   ├── verify/route.ts    ← Unified Verification API (Deterministic + Stat + Gemma 4)
│   │   │   ├── release/route.ts   ← Server-side Quality Gate & signed release records
│   │   │   ├── session/route.ts   ← Shared review state between Extension & Web
│   │   │   ├── extract/route.ts   ← Multimodal document OCR via Gemma 4
│   │   │   └── summarize/route.ts ← Executive plain-language summary
│   │   └── globals.css            ← TrueNorth Design System tokens and styles
│   │
│   ├── lib/
│   │   ├── types.ts               ← Zod schemas, 4 finding categories, quality gate states
│   │   ├── verification-engine.ts ← Core engine: code certainty + stats + Gemma reasoning
│   │   ├── review-store.ts        ← In-memory session store for cross-interface synchronization
│   │   ├── rules-engine.ts        ← Rule dispatch & resolution helpers
│   │   └── demo-cache.ts          ← Pre-cached invoice extraction for instant offline demo
│   │
│   └── components/
│       ├── Uploader.tsx           ← Drag-and-drop document photo zone
│       ├── EntryTable.tsx         ← Manual entry table
│       ├── FindingsPanel.tsx      ← Categorized findings review, audit trail & exception actions
│       └── ExportGate.tsx         ← Quality gate card enforcing release policies
│
├── data/
│   └── rules.json                 ← Configurable business rules & statistical baselines
├── test-suite.mjs                 ← Automated verification engine unit test suite
└── package.json
```

---

## How Gemma 4 is Integrated

Gemma 4 (`gemma-4-26b-a4b-it`) serves three distinct, high-impact roles:
1. **Multimodal Visual Extraction (`/api/extract`)**: Interprets images of handwritten and printed bills, returning structured line items, subtotals, taxes, and vendor data.
2. **Contextual Reasoning & Anomaly Detection (`/api/verify`)**: Analyzes the submitted transaction against business domain and contextual parameters. Identifies semantic anomalies that hardcoded rules cannot detect without promoting mere suspicions to errors.
3. **Plain-Language Executive Summary (`/api/summarize`)**: Synthesizes open and resolved issues into concise, non-technical plain-language summaries for auditors and department heads.

*Security Guarantee:* The Gemini API key remains strictly on the server (`process.env.gemini_api_key`) and is never bundled in client-side code or the browser extension.

---

## Quickstart & Installation

### Prerequisites
- Node.js 18+ (tested on Node 20 & 22)
- Google Gemini API key ([Google AI Studio](https://aistudio.google.com/)) — free tier supported

### 1. Run the Web Workspace
```bash
git clone https://github.com/YOUR_USERNAME/truenorth.git
cd truenorth
npm install
```

Copy the environment template and add your API key:
```bash
cp .env.example .env.local
```
*(On Windows PowerShell: `Copy-Item .env.example .env.local`)*

Edit `.env.local`:
```env
gemini_api_key=YOUR_GEMINI_API_KEY_HERE
```

Start the application:
```bash
npm run dev -- --port 3001
```
Open [http://localhost:3001](http://localhost:3001) in your browser.

### 2. Install the Browser Extension
1. Open Google Chrome or Microsoft Edge and navigate to `chrome://extensions/`.
2. Enable **Developer mode** (toggle in top right).
3. Click **Load unpacked**.
4. Select the `extension/` folder located inside the repository.
5. The **TrueNorth** extension icon (`T`) will appear in your browser toolbar.

---

## Automated Verification Tests

Run the standalone verification engine test suite:
```bash
node test-suite.mjs
```
Validates arithmetic discrepancy detection, required field enforcement, statistical outlier detection, and quality gate state transitions.

---

## End-to-End Demonstration Script

### Scenario A: Web Workspace Verification & Quality Gate Release
1. Open `http://localhost:3001`.
2. Click **"⚡ Load Demo Invoice Sample"**.
3. Notice that 3 discrepancies are detected:
   - Arithmetic error: Total 54,000 does not equal 5 × 3,200 = 16,000.
   - Document total mismatch: Typed 54,000 vs document visual 50,400.
   - Invoice transposition: Typed `INV-2026-0824` vs document visual `INV-2026-0842`.
4. Observe that the **Quality Gate is Blocked** (Release button locked).
5. Resolve findings:
   - Click **"✓ Adopt Document Value (50400)"**.
   - Click **"✓ Adopt Document Value (INV-2026-0842)"**.
   - Correct the arithmetic line or accept the legitimate manual override with a required reason.
6. Once all blocking findings are resolved, the Quality Gate transitions to **Ready for Release**.
7. Click **"🚀 Authorize & Release Data"** to generate the signed release record and download verified CSV/JSON audit bundles.

### Scenario B: In-Workflow Browser Extension & Pre-Submission Guard
1. Open `http://localhost:3001/demo-form`.
2. Click **"⚡ Load Flawed Sample"**.
3. Click the TrueNorth extension icon in your browser toolbar.
4. Click **"Inspect Form"** — all visible fields are instantly captured into the extension.
5. Click **"Verify Entries"** — the extension calls the verification engine, highlights flagged inputs in red on the webpage, and displays blocking findings.
6. Attempt to click **"🚀 Submit Voucher to Accounting"** on the webpage — the in-page **Pre-Submission Guard halts submission** with a blocking alert!
7. Resolve or accept the exceptions inside the extension or click **"Open Full Web Workspace →"** to sync the session to the main workspace.

---

## Quality Gate States

| State | Condition | Downstream Action |
|---|---|---|
| `not_checked` | Data has not been verified | Submission blocked by guard |
| `checking` | Pipeline executing | In-progress spinner |
| `blocked` | Open blocking rule violations exist | **Release strictly forbidden** |
| `needs_review` | Open contextual warnings or suspicions | Review recommended before sign-off |
| `ready_for_release` | All blocking findings resolved | Authorized for downstream release |
| `released` | Released with cryptographic seal | Verified audit record generated |

---

## License

MIT License. Designed and engineered for the Hacktoberfest Hack Day & Open-Source AI Challenge.
