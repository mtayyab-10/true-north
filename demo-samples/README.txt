Demo Samples — Tasdeeq

== Sample 1: Al-Kareem General Store Invoice ==

Document to photograph (or use the pre-cached extraction in demo-cache.ts):

  AL-KAREEM GENERAL STORE
  فاتحہ بازار، فیصل آباد
  
  Invoice #: INV-2026-0842
  Date: 15 Oct 2026
  
  Item                    Qty   Unit Price   Total
  ─────────────────────────────────────────────────
  Basmati Rice (25 kg)     5      3,200      16,000
  Cooking Oil (5 L)       12        850      10,200
  Sugar (50 kg)            2      6,500      13,000
  Flour (10 kg)            8      1,100       8,800
  ─────────────────────────────────────────────────
  Subtotal                               48,000
  GST (5%)                                2,400
  TOTAL                    PKR           50,400

Planted errors in typed_entries (demo_typed_entries.csv):
  1. invoice_number: typed "INV-2026-0824" (digit transposition)
  2. total_amount:   typed "54000" (incorrect total)

Expected findings after compare:
  - F001 (R003): Invoice number mismatch — HIGH
  - F002 (R001): Total amount mismatch — HIGH

For the physical demo:
  - Write the invoice above by hand on A4 paper
  - Add a few Urdu labels (e.g., کل رقم for Total, تاریخ for Date)
  - Photograph under good light, no blur
  - File: demo-samples/demo_invoice_photo.jpg (add before demo day)
