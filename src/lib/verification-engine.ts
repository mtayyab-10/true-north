import type {
  ExtractionResult,
  TypedEntry,
  Finding,
  BusinessContext,
  QualityGateState,
  FindingCategory,
  Severity,
} from "./types";
import { GoogleGenAI } from "@google/genai";

let findingSeq = 0;
function nextId(): string {
  return `F${String(++findingSeq).padStart(3, "0")}`;
}

export function parseNumeric(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const cleaned = String(val).replace(/[,،\s]/g, "").replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Regional commodity baselines for outlier signals
const BENCHMARK_PRICES: Record<string, { min: number; max: number; unit: string }> = {
  rice: { min: 2000, max: 4500, unit: "bag" },
  oil: { min: 600, max: 1500, unit: "tin" },
  sugar: { min: 4000, max: 8000, unit: "bag" },
  flour: { min: 800, max: 1800, unit: "bag" },
  cement: { min: 1100, max: 1600, unit: "bag" },
};

// ── 1. Deterministic Checks (Ordinary Code for Certainty) ─────────────────────
export function runDeterministicChecks(
  entries: TypedEntry[],
  doc?: ExtractionResult | null,
  context?: BusinessContext
): Finding[] {
  const findings: Finding[] = [];
  const map = new Map<string, string>();
  for (const e of entries) {
    map.set(e.field, e.typed_value);
  }

  const get = (key: string): string => (map.get(key) ?? "").trim();

  // (A) Mandatory Required Fields
  const requiredFields = [
    { key: "vendor_name", label: "Vendor Name" },
    { key: "invoice_number", label: "Invoice Number" },
    { key: "date", label: "Date" },
    { key: "total_amount", label: "Total Amount" },
  ];

  for (const req of requiredFields) {
    const val = get(req.key);
    if (!val) {
      findings.push({
        finding_id: nextId(),
        rule_id: "RULE_REQ_FIELD",
        category: "rule_violation",
        field: req.key,
        label: req.label,
        typed_value: "",
        document_value: doc ? ((doc as any)[req.key]?.toString() ?? "") : "",
        evidence: `Mandatory field "${req.label}" is missing.`,
        explanation: `${req.label} is strictly required before pre-submission release.`,
        suggested_action: `Enter the missing ${req.label}.`,
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    }
  }

  const totalAmountNum = parseNumeric(get("total_amount"));
  const subtotalNum = parseNumeric(get("subtotal"));
  const taxNum = parseNumeric(get("tax"));

  // Check negative numbers
  if (totalAmountNum !== null && totalAmountNum < 0) {
    findings.push({
      finding_id: nextId(),
      rule_id: "RULE_NON_NEGATIVE",
      category: "rule_violation",
      field: "total_amount",
      label: "Total Amount",
      typed_value: get("total_amount"),
      document_value: doc?.total_amount?.toString() ?? "",
      evidence: `Total amount is negative (${totalAmountNum}).`,
      explanation: "Standard vouchers cannot have a negative total.",
      suggested_action: "Remove negative sign or submit as a credit adjustment.",
      confidence: "high",
      severity: "blocking",
      status: "open",
    });
  }

  // Check Subtotal + Tax = Total (only when subtotal and tax are explicitly entered)
  if (subtotalNum !== null && taxNum !== null && totalAmountNum !== null) {
    const expectedTotal = subtotalNum + taxNum;
    if (Math.abs(expectedTotal - totalAmountNum) > 1) {
      findings.push({
        finding_id: nextId(),
        rule_id: "RULE_TAX_SUM",
        category: "rule_violation",
        field: "total_amount",
        label: "Total Amount",
        typed_value: get("total_amount"),
        expected_value: String(expectedTotal),
        evidence: `Subtotal (${subtotalNum}) + Tax (${taxNum}) = ${expectedTotal}, but Total is ${totalAmountNum}.`,
        explanation: `Arithmetic discrepancy of ${Math.abs(expectedTotal - totalAmountNum)}.`,
        suggested_action: `Update Total Amount to ${expectedTotal}.`,
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    }
  }

  // Date Format Sanity Check
  const dateVal = get("date");
  if (dateVal) {
    const parsedDate = new Date(dateVal);
    if (isNaN(parsedDate.getTime())) {
      findings.push({
        finding_id: nextId(),
        rule_id: "RULE_INVALID_DATE",
        category: "rule_violation",
        field: "date",
        label: "Date",
        typed_value: dateVal,
        evidence: `Invalid date format "${dateVal}".`,
        explanation: "Date cannot be parsed into a calendar date.",
        suggested_action: "Use YYYY-MM-DD or DD/MM/YYYY.",
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    } else {
      const now = new Date();
      const futureLimit = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      if (parsedDate > futureLimit) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_FUTURE_DATE",
          category: "rule_violation",
          field: "date",
          label: "Date",
          typed_value: dateVal,
          evidence: `Date "${dateVal}" is dated in the future.`,
          explanation: "Invoices cannot be dated months ahead of transaction date.",
          suggested_action: "Verify the year (e.g. 2026 instead of 2036).",
          confidence: "high",
          severity: "blocking",
          status: "open",
        });
      }
    }
  }

  // (B) Document Cross-Verification (Authoritative Document Comparison)
  if (doc) {
    // Total Amount mismatch
    if (doc.total_amount !== null && doc.total_amount !== undefined && totalAmountNum !== null) {
      if (Math.abs(doc.total_amount - totalAmountNum) > 0.5) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_DOC_TOTAL_MISMATCH",
          category: "rule_violation",
          field: "total_amount",
          label: "Total Amount",
          typed_value: get("total_amount"),
          document_value: String(doc.total_amount),
          evidence: `Typed value is ${totalAmountNum}, but document says ${doc.total_amount}.`,
          explanation: `Discrepancy of ${Math.abs(doc.total_amount - totalAmountNum)} between entered data and scanned document.`,
          suggested_action: `Update to document value (${doc.total_amount}).`,
          confidence: "high",
          severity: "blocking",
          status: "open",
        });
      }
    }

    // Invoice number mismatch (e.g. digit transposition)
    const typedInv = get("invoice_number");
    if (doc.invoice_number && typedInv) {
      const cleanTyped = typedInv.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      const cleanDoc = doc.invoice_number.replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
      if (cleanTyped !== cleanDoc) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_DOC_INV_MISMATCH",
          category: "rule_violation",
          field: "invoice_number",
          label: "Invoice Number",
          typed_value: typedInv,
          document_value: doc.invoice_number,
          evidence: `Typed "${typedInv}" differs from document "${doc.invoice_number}". Possible digit transposition.`,
          explanation: `Invoice ID does not match scanned document.`,
          suggested_action: `Adopt document value "${doc.invoice_number}".`,
          confidence: "high",
          severity: "blocking",
          status: "open",
        });
      }
    }

    // Vendor name comparison
    const typedVendor = get("vendor_name");
    if (doc.vendor_name && typedVendor) {
      if (typedVendor.trim().toLowerCase() !== doc.vendor_name.trim().toLowerCase()) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_DOC_VENDOR_MISMATCH",
          category: "rule_violation",
          field: "vendor_name",
          label: "Vendor Name",
          typed_value: typedVendor,
          document_value: doc.vendor_name,
          evidence: `Typed vendor "${typedVendor}" differs from document "${doc.vendor_name}".`,
          explanation: "Spelling or name mismatch between entry and document.",
          suggested_action: `Update to document vendor name "${doc.vendor_name}".`,
          confidence: "medium",
          severity: "warning",
          status: "open",
        });
      }
    }
  }

  return findings;
}

// ── 2. Statistical Signals & Commodity Benchmarks (Only when un-backed by doc) ─
export function runStatisticalSignals(
  entries: TypedEntry[],
  doc?: ExtractionResult | null,
  context?: BusinessContext
): Finding[] {
  const findings: Finding[] = [];
  // If document extraction confirmed the pricing, do not raise redundant statistical flags
  if (doc) return findings;

  const map = new Map<string, string>();
  for (const e of entries) {
    map.set(e.field, e.typed_value);
  }

  const get = (key: string): string => (map.get(key) ?? "").trim();
  const unitPrice = parseNumeric(get("unit_price"));
  const rawItemName = (get("item_description") + " " + get("vendor_name")).toLowerCase();

  if (unitPrice !== null) {
    for (const [commodity, bench] of Object.entries(BENCHMARK_PRICES)) {
      if (rawItemName.includes(commodity)) {
        if (unitPrice > bench.max * 3.0) {
          findings.push({
            finding_id: nextId(),
            rule_id: "STAT_PRICE_OUTLIER_HIGH",
            category: "contextual_suspicion",
            field: "unit_price",
            label: "Unit Price",
            typed_value: String(unitPrice),
            evidence: `Unit price (${unitPrice}) is ${(unitPrice / bench.max).toFixed(1)}x above expected market baseline (${bench.min}–${bench.max} per ${bench.unit}).`,
            explanation: "Extreme outlier unit price indicates potential pack size confusion or misplaced decimal.",
            suggested_action: "Confirm if this represents a bulk package or typographical error.",
            confidence: "medium",
            severity: "warning",
            status: "open",
          });
        }
      }
    }
  }

  return findings;
}

// ── 3. Gemma 4 Contextual Reasoner ───────────────────────────────────────────
export async function runGemmaContextualAnalysis(
  entries: TypedEntry[],
  context?: BusinessContext,
  apiKey?: string
): Promise<{ findings: Finding[]; summary: string }> {
  if (!apiKey) {
    return {
      findings: [],
      summary: "Deterministic checks verified data integrity.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const entriesStr = entries.map((e) => `${e.field}: "${e.typed_value}"`).join("\n");
  const ctxStr = context
    ? `Business Type: ${context.business_type}, Currency: ${context.currency}, Reporting Period: ${context.reporting_period}`
    : "Standard Commercial Record";

  const prompt = `You are Tasdeeq's pre-submission verification agent.
Analyze the following transaction entries in the context of the business domain:
---
CONTEXT:
${ctxStr}

ENTRIES:
${entriesStr}
---

Task:
If there is a severe semantic mismatch (e.g. medical store ordering industrial iron bars, or contradictory currencies), identify it.
Return ONLY valid JSON:
{
  "contextual_findings": [
    {
      "category": "contextual_suspicion",
      "field": string,
      "label": string,
      "severity": "warning",
      "evidence": string,
      "explanation": string,
      "suggested_action": string
    }
  ],
  "reasoning_summary": string
}
If data is normal, return empty contextual_findings and a concise 1-sentence summary.`;

  try {
    const response = await ai.models.generateContent({
      model: "gemma-4-26b-a4b-it",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const raw = (response.text ?? "").trim();
    const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();

    let parsed: any;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) parsed = JSON.parse(match[0]);
    }

    if (!parsed) {
      return { findings: [], summary: "Gemma 4 contextual review completed." };
    }

    const aiFindings: Finding[] = (parsed.contextual_findings || []).map((cf: any) => ({
      finding_id: nextId(),
      rule_id: "GEMMA_CTX_ANALYSIS",
      category: "contextual_suspicion",
      field: cf.field || "general",
      label: cf.label || cf.field || "Contextual Review",
      typed_value: entries.find((e) => e.field === cf.field)?.typed_value || "",
      document_value: "",
      evidence: cf.evidence || "Contextual check flagged an anomaly.",
      explanation: cf.explanation || "Review recommended by AI contextual reasoning engine.",
      suggested_action: cf.suggested_action || "Verify entry context.",
      confidence: "medium",
      severity: "warning",
      status: "open",
    }));

    return {
      findings: aiFindings,
      summary: parsed.reasoning_summary || "Contextual analysis completed.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      findings: [],
      summary: "Verification completed via deterministic rules.",
    };
  }
}

// ── 4. Quality Gate Evaluator ────────────────────────────────────────────────
export function evaluateQualityGate(findings: Finding[]): {
  gateState: QualityGateState;
  blockingCount: number;
  warningsCount: number;
  openCount: number;
  resolvedCount: number;
} {
  const openFindings = findings.filter((f) => f.status === "open");
  const openBlocking = openFindings.filter((f) => f.severity === "blocking" || f.severity === "high");
  const openWarnings = openFindings.filter((f) => f.severity === "warning" || f.severity === "medium");
  const resolvedCount = findings.filter((f) => f.status !== "open").length;

  let gateState: QualityGateState = "ready_for_release";

  if (openBlocking.length > 0) {
    gateState = "blocked";
  } else if (openWarnings.length > 0) {
    gateState = "needs_review";
  } else {
    gateState = "ready_for_release";
  }

  return {
    gateState,
    blockingCount: openBlocking.length,
    warningsCount: openWarnings.length,
    openCount: openFindings.length,
    resolvedCount,
  };
}

// ── 5. Full Unified Verification Pipeline with Deduplication ─────────────────
export async function runUnifiedVerification(params: {
  entries: TypedEntry[];
  documentExtraction?: ExtractionResult | null;
  context?: BusinessContext;
  apiKey?: string;
  skipGemma?: boolean;
}): Promise<{
  findings: Finding[];
  gateState: QualityGateState;
  summary: string;
  stats: {
    totalFindings: number;
    blocking: number;
    warnings: number;
    resolved: number;
  };
}> {
  findingSeq = 0;

  // Step 1: Deterministic Checks
  const deterministicFindings = runDeterministicChecks(
    params.entries,
    params.documentExtraction,
    params.context
  );

  // Step 2: Statistical Signals (only if not verified by document)
  const statisticalFindings = runStatisticalSignals(
    params.entries,
    params.documentExtraction,
    params.context
  );

  // Step 3: Gemma 4 Contextual Reasoner
  let gemmaFindings: Finding[] = [];
  let summary = "";

  if (!params.skipGemma && params.apiKey) {
    const aiResult = await runGemmaContextualAnalysis(
      params.entries,
      params.context,
      params.apiKey
    );
    gemmaFindings = aiResult.findings;
    summary = aiResult.summary;
  } else {
    summary = "Verified using deterministic checks and baseline verification.";
  }

  const rawFindings = [
    ...deterministicFindings,
    ...statisticalFindings,
    ...gemmaFindings,
  ];

  // ── DEDUPLICATION: Maximum 1 primary finding per field ──────────────────────
  // Prioritize blocking errors over warnings, deterministic over suspicions
  const fieldMap = new Map<string, Finding>();
  for (const f of rawFindings) {
    const existing = fieldMap.get(f.field);
    if (!existing) {
      fieldMap.set(f.field, f);
    } else {
      const isCurrentBlocking = f.severity === "blocking" || f.severity === "high";
      const isExistingBlocking = existing.severity === "blocking" || existing.severity === "high";
      if (isCurrentBlocking && !isExistingBlocking) {
        fieldMap.set(f.field, f);
      }
    }
  }

  const deduplicatedFindings = Array.from(fieldMap.values());
  const gate = evaluateQualityGate(deduplicatedFindings);

  return {
    findings: deduplicatedFindings,
    gateState: gate.gateState,
    summary,
    stats: {
      totalFindings: deduplicatedFindings.length,
      blocking: gate.blockingCount,
      warnings: gate.warningsCount,
      resolved: gate.resolvedCount,
    },
  };
}
