# OrganizerHQ Submission Text — Tasdeeq

## Project Name
Tasdeeq (تصدیق)

## One-line Description
AI-powered document verification that catches typing errors in handwritten bills
and invoices before they cost small businesses money — powered by Gemma 4.

## Full Description (paste into OrganizerHQ)
Small shop owners in Pakistan keep handwritten ledgers, bills and invoices,
then retype the numbers into a spreadsheet by hand. Digit transpositions and
wrong totals go unnoticed until they cause a real financial loss.

Tasdeeq (Urdu for "verification") closes that gap in four steps:

1. UPLOAD — The user uploads a photo of a bill, ledger or invoice.
   English and Urdu labels are both supported.

2. EXTRACT — Gemma 4 (gemma-4-26b-a4b-it, 26B parameter open-weight model)
   reads the image through the Gemini API and returns structured JSON:
   vendor name, invoice number, date, line items, subtotals and totals.

3. COMPARE — Plain code (not the model) compares the extracted values against
   the user's typed entries using a swappable rules.json file.
   Each rule has a rule_id, field, check type, tolerance and severity.
   The model never decides what is a mismatch. Code does.

4. RESOLVE & EXPORT — Each finding shows the field, the typed value, what
   the document says, the evidence, confidence and severity.
   The user resolves each one: accept document value, keep typed value, or edit.
   The export gate releases a verified CSV only when every finding is resolved.
   Gemma also writes a short plain-language summary in English or Urdu.

What makes this different from a standard OCR pipeline: Gemma's multimodal
capability handles handwritten Urdu and English labels on the same document,
in one shot, without a separate OCR service. The model does the reading;
code does all the checking.

## Technologies
- Gemma 4 26B A4B IT (gemma-4-26b-a4b-it) via Gemini API
- @google/genai (official Google GenAI JavaScript SDK)
- Next.js 15 (App Router) + TypeScript
- Zod (runtime schema validation)
- Vanilla CSS (custom dark design system)
- MIT License (project code); Apache 2.0 (Gemma model)

## GitHub Repository
[Add your GitHub repo URL here]

## Challenges to tick
- [x] Best Open-Source AI Project
- [x] Best Use of Gemma 4
