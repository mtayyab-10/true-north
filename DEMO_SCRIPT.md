# Tasdeeq — 3-Minute Demo Script
# Hacktoberfest Hack Day Faisalabad 2026

---

## PART 1 — Problem (20 seconds)

"Small shop owners in Pakistan keep handwritten bills and invoices,
then retype the numbers into a spreadsheet by hand.
Digit transpositions and wrong totals go unnoticed until they cause a real loss.
Tasdeeq catches those mistakes before the entry is saved."

---

## PART 2 — Live Demo (90 seconds)

**[Have the app open on localhost:3000 before your slot]**

1. (0:00) Show the document photo on screen.
   "Here is a real handwritten invoice from Al-Kareem General Store —
   vendor name in English, some labels in Urdu."

2. (0:10) Click [Extract with Gemma 4].
   While it loads (3–8 sec): "Gemma is reading the image right now."
   When it returns: "Look — it extracted the vendor name, invoice number,
   date, line items, subtotal, tax, and total. Even identified mixed-language labels."

3. (0:35) Show the typed entries panel.
   "I typed INV-2026-0824 and a total of 54,000 rupees into my records."
   Point at the table.

4. (0:45) Click [Find Mismatches].
   "Two findings appear immediately."
   Read them: "Invoice number transposed — 824 typed, 842 on the document.
   Total amount wrong — 54,000 typed, 50,400 on the document."

5. (1:05) Resolve findings.
   Click [Use document value] on invoice number.
   Click [Use document value] on total.
   "Both resolved. The export gate is now unlocked."

6. (1:20) Click [Generate Summary] in Urdu.
   Show the Urdu text. "Gemma explains the findings in plain Urdu."

7. (1:30) Click [Export Verified CSV].
   "The verified batch downloads. If I hadn't resolved those findings,
   this button would have stayed locked."

---

## PART 3 — How Gemma is Used (30 seconds)

"Gemma 4 26B A4B IT is the model — a 26-billion-parameter open-weight
multimodal model from Google, accessed through the Gemini API.

It does two jobs: first, it reads the document image and returns
structured JSON — line items, totals, labels in English and Urdu.
Second, it writes the plain-language summary.

The API key never reaches the browser. It lives only in the server route.
Gemma does the reading. Code does the checking. That separation is intentional."

---

## PART 4 — What's Next (20 seconds)

"We want to add multi-page ledger support and a PHP version checker
as a second use-case of the same rules-engine pattern.
The core pattern — image evidence, code-based gate, human resolution —
is reusable for any domain where paper records meet digital entry."

---

## BACKUP PLAN (if Wi-Fi fails)

1. Click [Load demo sample] — this loads the pre-cached extraction with no network.
2. The two findings appear from the cache. Resolve them live.
3. Say: "I have a cached extraction from an earlier run so the demo
   continues offline. In production Gemma calls the Gemini API live."
4. Show the screen recording video as secondary backup.

---

## Pre-demo checklist (15 min before your slot)

- [ ] localhost:3000 is running (npm run dev)
- [ ] Browser is on the home page, nothing typed
- [ ] Demo invoice photo is ready (or demo mode button visible)
- [ ] Screen recording started (OBS or Windows Game Bar Win+G)
- [ ] Demo typed entries ready: INV-2026-0824 and 54000
- [ ] Language selector set to "اردو" for the summary
- [ ] Backup: demo mode button tested and working
