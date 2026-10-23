/**
 * demo-cache.ts
 * Pre-cached extraction result for the demo invoice sample.
 * Used as offline fallback when the Gemini API is unavailable.
 */
import type { ExtractionResult } from "./types";

export const DEMO_EXTRACTION: ExtractionResult = {
  vendor_name: "Al-Kareem General Store",
  invoice_number: "INV-2026-0842",
  date: "2026-10-15",
  line_items: [
    { description: "Basmati Rice (25 kg)", quantity: 5, unit_price: 3200, line_total: 16000 },
    { description: "Cooking Oil (5 L)", quantity: 12, unit_price: 850, line_total: 10200 },
    { description: "Sugar (50 kg)", quantity: 2, unit_price: 6500, line_total: 13000 },
    { description: "Flour (10 kg)", quantity: 8, unit_price: 1100, line_total: 8800 },
  ],
  subtotal: 48000,
  tax: 2400,
  total_amount: 50400,
  currency: "PKR",
  raw_text_snippet: "الکریم جنرل اسٹور — فاتحہ بازار، فیصل آباد",
  language_detected: "mixed",
};

// Typed entries with intentional errors planted for demo purposes
export const DEMO_TYPED_ENTRIES = [
  { id: "e1", field: "vendor_name",    typed_value: "Al-Kareem General Store" },
  { id: "e2", field: "invoice_number", typed_value: "INV-2026-0824" },  // ← transposition error: 824 vs 842
  { id: "e3", field: "date",           typed_value: "2026-10-15" },
  { id: "e4", field: "total_amount",   typed_value: "54000" },           // ← typed wrong: 54000 vs 50400
  { id: "e5", field: "quantity",       typed_value: "5" },
  { id: "e6", field: "unit_price",     typed_value: "3200" },
];
