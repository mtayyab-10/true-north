import { z } from "zod";

// ── Extracted line item from the document image ──────────────────────────────
export const ExtractedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional(),
  unit_price: z.number().optional(),
  line_total: z.number().optional(),
});

// ── Full extraction result returned by Gemma ─────────────────────────────────
export const ExtractionResultSchema = z.object({
  vendor_name: z.string().optional(),
  invoice_number: z.string().optional(),
  date: z.string().optional(),
  line_items: z.array(ExtractedLineItemSchema),
  subtotal: z.number().optional(),
  tax: z.number().optional(),
  total_amount: z.number().optional(),
  currency: z.string().optional(),
  raw_text_snippet: z.string().optional(),
  language_detected: z.enum(["en", "ur", "mixed"]).optional(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;

// ── A single typed entry submitted by the user ───────────────────────────────
export const TypedEntrySchema = z.object({
  id: z.string(),
  field: z.string(),
  typed_value: z.string(),
});
export type TypedEntry = z.infer<typeof TypedEntrySchema>;

// ── Severity ─────────────────────────────────────────────────────────────────
export const SeveritySchema = z.enum(["high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ── A single finding produced by the rules engine ────────────────────────────
export const FindingSchema = z.object({
  finding_id: z.string(),
  rule_id: z.string(),
  field: z.string(),
  typed_value: z.string(),
  document_value: z.string(),
  evidence: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  severity: SeveritySchema,
  status: z.enum(["open", "accepted_doc", "kept_typed", "edited"]),
  resolved_value: z.string().optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

// ── A rule from rules.json ────────────────────────────────────────────────────
export interface Rule {
  rule_id: string;
  field: string;
  description: string;
  check_type: "equals" | "equals_ci" | "within_tolerance" | "sum_matches";
  tolerance?: number;
  severity: Severity;
}

// ── Batch state ───────────────────────────────────────────────────────────────
export type BatchStatus = "idle" | "extracted" | "compared" | "released";

export interface BatchState {
  status: BatchStatus;
  extraction: ExtractionResult | null;
  typedEntries: TypedEntry[];
  findings: Finding[];
  summary: string | null;
}

// ── API request/response shapes ───────────────────────────────────────────────
export const ExtractRequestSchema = z.object({
  imageBase64: z.string(),
  mimeType: z.string(),
});

export const SummarizeRequestSchema = z.object({
  findings: z.array(FindingSchema),
  language: z.enum(["en", "ur"]),
});
