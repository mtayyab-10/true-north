# OrganizerHQ Submission Text — TrueNorth (Tasdeeq تصدیق)

## Project Name
TrueNorth (Tasdeeq تصدیق)

## One-line Description
Context-aware pre-submission quality gate and browser extension that catches clerical blunders, arithmetic mismatches, and data anomalies before database entry — powered by Gemma 4.

## Full Description (paste into OrganizerHQ)
Clerical errors, wrong totals, digit transpositions, and contextual outliers cost businesses real money when committed into accounting software, ERPs, or ledgers. 

TrueNorth (Tasdeeq) acts as an intelligent pre-submission quality gate that catches incorrect data *before* it is saved. It follows the core principle:
"Ordinary code for certainty. Statistics for signals. An agent for context. Human review for accountability."

It delivers two synchronized interfaces powered by a unified 4-tier verification engine:

1. MAIN WEB WORKSPACE:
   - Upload handwritten/printed bill or invoice photos (English & Urdu labels supported).
   - Multimodal Gemma 4 (gemma-4-26b-a4b-it, 26B open-weight LLM) extracts structured line items, subtotals, and totals.
   - Deterministic rules test arithmetic (qty × unit_price = total), mandatory fields, date validity, and document discrepancies.
   - Gemma 4 analyzes semantic context (e.g. pharmacy ordering industrial rebar) and flags suspicions without false blocking.
   - Interactive review with visual evidence, 1-click document adoption, and business justification notes.
   - Poka-Yoke Quality Gate prevents data export until all blocking violations are resolved, producing cryptographically signed release certificates and CSV/JSON audit logs.
   - Gemma 4 generates executive summaries in plain English or Urdu (اردو).

2. CHROMIUM BROWSER EXTENSION (Manifest V3):
   - Inspects live web forms across third-party accounting and ERP portals.
   - Highlights flagged inputs directly in the page DOM (red glow for blocking errors, amber for suspicions).
   - In-Page Pre-Submission Guard intercepts form submission buttons if unresolved blocking errors exist.
   - One-click session transfer into the full Web Workspace.

## Technologies
- Gemma 4 26B A4B IT (`gemma-4-26b-a4b-it`, 26B Open-Weight LLM by Google)
- Google GenAI SDK (`@google/genai`)
- Next.js 15 (App Router) + React 19 + TypeScript
- Manifest V3 Browser Extension (Chrome / Edge)
- Zod (Runtime schema validation)
- Custom Vanilla CSS Design System
- Open-Source MIT License (Project) & Google Gemma Terms of Use (Model)

## GitHub Repository
https://github.com/mtayyab-10/true-north

## Open-Weight Model Verification
- Model Name: Gemma 4 26B A4B IT (gemma-4-26b-a4b-it)
- Model Terms & License: https://ai.google.dev/gemma/terms
- DeepMind Gemma Overview: https://ai.google.dev/gemma

## Challenges to tick
- [x] Best Open-Source AI Project
- [x] Best Use of Gemma 4
