import { z } from "zod";

// ── Extracted line item from the document image ──────────────────────────────
export const ExtractedLineItemSchema = z.object({
  description: z.string(),
  quantity: z.number().optional().nullable(),
  unit_price: z.number().optional().nullable(),
  line_total: z.number().optional().nullable(),
});

// ── Full extraction result returned by Gemma ─────────────────────────────────
export const ExtractionResultSchema = z.object({
  vendor_name: z.string().optional().nullable(),
  invoice_number: z.string().optional().nullable(),
  date: z.string().optional().nullable(),
  line_items: z.array(ExtractedLineItemSchema).default([]),
  subtotal: z.number().optional().nullable(),
  tax: z.number().optional().nullable(),
  total_amount: z.number().optional().nullable(),
  currency: z.string().optional().nullable(),
  raw_text_snippet: z.string().optional().nullable(),
  language_detected: z.enum(["en", "ur", "mixed"]).optional().nullable(),
});

export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;
export type ExtractedLineItem = z.infer<typeof ExtractedLineItemSchema>;

// ── A single typed entry / captured form entry ───────────────────────────────
export const TypedEntrySchema = z.object({
  id: z.string(),
  field: z.string(),
  label: z.string().optional(),
  typed_value: z.string(),
  field_type: z.string().optional(), // 'number', 'text', 'date', 'select', etc.
});
export type TypedEntry = z.infer<typeof TypedEntrySchema>;

// ── Finding Categories (Required 4 distinct categories) ──────────────────────
export const FindingCategorySchema = z.enum([
  "rule_violation",       // Deterministic check established a failure
  "contextual_suspicion",  // AI or statistical analysis identified anomaly/suspicion
  "uncertain_extraction", // Value unreadable / OCR confidence low
  "missing_context",      // Responsible evaluation requires additional context
]);
export type FindingCategory = z.infer<typeof FindingCategorySchema>;

// ── Severity ─────────────────────────────────────────────────────────────────
export const SeveritySchema = z.enum(["blocking", "warning", "info", "high", "medium", "low"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ── Finding Status & Audit ───────────────────────────────────────────────────
export const FindingStatusSchema = z.enum([
  "open",
  "resolved_accepted",  // Legitimate exception accepted with reason
  "resolved_corrected", // Value corrected to accurate figure
  "dismissed",          // Dismissed with explicit explanation
  // Legacy aliases for backward compatibility:
  "accepted_doc",
  "kept_typed",
  "edited",
]);
export type FindingStatus = z.infer<typeof FindingStatusSchema>;

export interface ResolutionAudit {
  status: FindingStatus;
  timestamp: string;
  reason?: string;
  previous_value: string;
  resolved_value: string;
}

// ── Full Finding Structure ───────────────────────────────────────────────────
export const FindingSchema = z.object({
  finding_id: z.string(),
  rule_id: z.string(),
  category: FindingCategorySchema.default("rule_violation"),
  field: z.string(),
  label: z.string().optional(),
  typed_value: z.string(),
  document_value: z.string().default("").optional(),
  observed_value: z.string().optional(),
  expected_value: z.string().optional(),
  evidence: z.string(),
  explanation: z.string().optional(),
  suggested_action: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]).default("high"),
  severity: SeveritySchema,
  status: FindingStatusSchema.default("open"),
  resolved_value: z.string().optional(),
  resolution_reason: z.string().optional(),
  audit_trail: z.array(z.any()).optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

// ── Quality Gate State ───────────────────────────────────────────────────────
export type QualityGateState =
  | "not_checked"
  | "checking"
  | "needs_review"
  | "blocked"
  | "ready_for_release"
  | "released";

// ── Business Context ─────────────────────────────────────────────────────────
export const BusinessContextSchema = z.object({
  business_type: z.string().default("General Commerce"),
  currency: z.string().default("PKR"),
  reporting_period: z.string().default("Current Period"),
  allowed_variance_pct: z.number().default(0),
  notes: z.string().optional(),
});
export type BusinessContext = z.infer<typeof BusinessContextSchema>;

// ── Release Record ───────────────────────────────────────────────────────────
export interface ReleaseRecord {
  release_id: string;
  timestamp: string;
  quality_gate_state: "released";
  total_entries: number;
  total_findings: number;
  resolved_findings: number;
  data_snapshot: TypedEntry[];
  audit_log: {
    finding_id: string;
    field: string;
    category: FindingCategory;
    resolution: FindingStatus;
    reason?: string;
    final_value: string;
  }[];
  verification_checksum: string;
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

export const VerifyRequestSchema = z.object({
  entries: z.array(TypedEntrySchema),
  documentExtraction: ExtractionResultSchema.optional().nullable(),
  context: BusinessContextSchema.optional(),
});
export type VerifyRequest = z.infer<typeof VerifyRequestSchema>;

export const ReleaseRequestSchema = z.object({
  entries: z.array(TypedEntrySchema),
  findings: z.array(FindingSchema),
  context: BusinessContextSchema.optional(),
});
export type ReleaseRequest = z.infer<typeof ReleaseRequestSchema>;
