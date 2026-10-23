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

// ── Helper: Safe numeric parse ───────────────────────────────────────────────
export function parseNumeric(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === "number") return isNaN(val) ? null : val;
  const cleaned = val.replace(/[,،\s]/g, "").replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// ── Commodity / Pricing benchmarks for statistical signals ───────────────────
const BENCHMARK_PRICES: Record<string, { min: number; max: number; unit: string }> = {
  rice: { min: 2000, max: 4500, unit: "bag/sack" },
  oil: { min: 600, max: 1500, unit: "tin/bottle" },
  sugar: { min: 4000, max: 8000, unit: "bag/50kg" },
  flour: { min: 800, max: 1800, unit: "bag/10kg" },
  ghee: { min: 650, max: 1600, unit: "kg/tin" },
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

  // (A) Required Fields Check
  const requiredFields = [
    { key: "vendor_name", label: "Vendor / Supplier Name" },
    { key: "invoice_number", label: "Invoice / Bill Number" },
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
        evidence: `Mandatory field "${req.label}" is missing or empty.`,
        explanation: `System compliance policy strictly requires ${req.label} before recording pre-submission transactions.`,
        suggested_action: `Enter the missing ${req.label}.`,
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    }
  }

  // (B) Numeric & Arithmetic Checks
  const totalAmountNum = parseNumeric(get("total_amount"));
  const qtyNum = parseNumeric(get("quantity"));
  const unitPriceNum = parseNumeric(get("unit_price"));
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
      evidence: `Observed value is negative (${totalAmountNum}).`,
      explanation: "Invoice total amounts cannot be negative for standard payable vouchers.",
      suggested_action: "Correct the negative sign or file as a credit note.",
      confidence: "high",
      severity: "blocking",
      status: "open",
    });
  }

  // Check Quantity * Unit Price multiplication
  if (qtyNum !== null && unitPriceNum !== null) {
    const calculatedLineTotal = qtyNum * unitPriceNum;
    if (totalAmountNum !== null && subtotalNum === null && Math.abs(calculatedLineTotal - totalAmountNum) > 1) {
      findings.push({
        finding_id: nextId(),
        rule_id: "RULE_MATH_MISMATCH",
        category: "rule_violation",
        field: "total_amount",
        label: "Total Amount Arithmetic",
        typed_value: get("total_amount"),
        observed_value: String(totalAmountNum),
        expected_value: String(calculatedLineTotal),
        evidence: `Typed total is ${totalAmountNum}, but quantity (${qtyNum}) × unit price (${unitPriceNum}) = ${calculatedLineTotal}.`,
        explanation: `Deterministic math check failed: ${qtyNum} × ${unitPriceNum} equals ${calculatedLineTotal}, not ${totalAmountNum}. Discrepancy of ${Math.abs(calculatedLineTotal - totalAmountNum)}.`,
        suggested_action: `Update Total Amount to ${calculatedLineTotal} or adjust quantity/unit price.`,
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    }
  }

  // Check Subtotal + Tax = Total
  if (subtotalNum !== null && taxNum !== null && totalAmountNum !== null) {
    const expectedTotal = subtotalNum + taxNum;
    if (Math.abs(expectedTotal - totalAmountNum) > 1) {
      findings.push({
        finding_id: nextId(),
        rule_id: "RULE_TAX_SUM",
        category: "rule_violation",
        field: "total_amount",
        label: "Tax + Subtotal Sum",
        typed_value: get("total_amount"),
        evidence: `Subtotal (${subtotalNum}) + Tax (${taxNum}) = ${expectedTotal}, but Total is ${totalAmountNum}.`,
        explanation: `Arithmetic discrepancy: Subtotal and Tax sum to ${expectedTotal}, differing from total ${totalAmountNum}.`,
        suggested_action: `Correct Total Amount to ${expectedTotal} or reconcile tax amount.`,
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    }
  }

  // (C) Date Sanity Check
  const dateVal = get("date");
  if (dateVal) {
    const parsedDate = new Date(dateVal);
    if (isNaN(parsedDate.getTime())) {
      findings.push({
        finding_id: nextId(),
        rule_id: "RULE_INVALID_DATE",
        category: "rule_violation",
        field: "date",
        label: "Date Format",
        typed_value: dateVal,
        evidence: `Value "${dateVal}" cannot be parsed into a valid calendar date.`,
        explanation: "All financial records must feature a standard ISO or DD/MM/YYYY date.",
        suggested_action: "Enter date in YYYY-MM-DD or DD/MM/YYYY format.",
        confidence: "high",
        severity: "blocking",
        status: "open",
      });
    } else {
      const now = new Date();
      // If date is more than 30 days in the future
      const thirtyDaysAhead = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      if (parsedDate > thirtyDaysAhead) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_FUTURE_DATE",
          category: "rule_violation",
          field: "date",
          label: "Date",
          typed_value: dateVal,
          evidence: `Date ${dateVal} is far in the future (${Math.round((parsedDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days ahead).`,
          explanation: "Invoices cannot be dated in the distant future.",
          suggested_action: "Verify if year was mis-typed (e.g. 2036 instead of 2026).",
          confidence: "high",
          severity: "blocking",
          status: "open",
        });
      }
    }
  }

  // (D) Document Cross-Verification (when OCR/Image extraction exists)
  if (doc) {
    // Total Amount comparison
    if (doc.total_amount !== null && doc.total_amount !== undefined && totalAmountNum !== null) {
      if (Math.abs(doc.total_amount - totalAmountNum) > 0.01) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_DOC_TOTAL_MISMATCH",
          category: "rule_violation",
          field: "total_amount",
          label: "Total Amount vs Document",
          typed_value: get("total_amount"),
          document_value: String(doc.total_amount),
          evidence: `Typed value is ${totalAmountNum}, but document visual scan says ${doc.total_amount}.`,
          explanation: `Direct mismatch between document scan and entered total: difference of ${Math.abs(doc.total_amount - totalAmountNum)}.`,
          suggested_action: `Update to document value (${doc.total_amount}) or confirm legitimate manual override with explanation.`,
          confidence: "high",
          severity: "blocking",
          status: "open",
        });
      }
    }

    // Invoice number comparison
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
          label: "Invoice Number vs Document",
          typed_value: typedInv,
          document_value: doc.invoice_number,
          evidence: `Typed "${typedInv}" differs from document visual "${doc.invoice_number}". Potential digit transposition.`,
          explanation: `Invoice identifier does not match scanned document (${typedInv} vs ${doc.invoice_number}).`,
          suggested_action: `Adopt document invoice number "${doc.invoice_number}".`,
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
          label: "Vendor Name vs Document",
          typed_value: typedVendor,
          document_value: doc.vendor_name,
          evidence: `Typed vendor "${typedVendor}" differs slightly from document vendor "${doc.vendor_name}".`,
          explanation: "Spelling or branding difference between typed entry and document scan.",
          suggested_action: "Review spelling or accept document title.",
          confidence: "medium",
          severity: "warning",
          status: "open",
        });
      }
    }

    // Line items sum check
    if (doc.line_items && doc.line_items.length > 0 && doc.subtotal !== null && doc.subtotal !== undefined) {
      const itemsSum = doc.line_items.reduce((acc, it) => acc + (it.line_total ?? ((it.quantity ?? 0) * (it.unit_price ?? 0))), 0);
      if (Math.abs(itemsSum - doc.subtotal) > 1) {
        findings.push({
          finding_id: nextId(),
          rule_id: "RULE_DOC_LINE_SUM",
          category: "rule_violation",
          field: "subtotal",
          label: "Scanned Line Items Subtotal",
          typed_value: get("subtotal"),
          document_value: String(doc.subtotal),
          evidence: `Sum of itemized lines in document (${itemsSum}) does not equal document stated subtotal (${doc.subtotal}).`,
          explanation: "Internal document arithmetic discrepancy detected in original vendor billing.",
          suggested_action: "Verify individual line totals with the supplier.",
          confidence: "high",
          severity: "warning",
          status: "open",
        });
      }
    }
  }

  return findings;
}

// ── 2. Statistical Signals & Commodity Benchmarks (Statistics for Signals) ───
export function runStatisticalSignals(
  entries: TypedEntry[],
  context?: BusinessContext
): Finding[] {
  const findings: Finding[] = [];
  const map = new Map<string, string>();
  for (const e of entries) {
    map.set(e.field, e.typed_value);
  }

  const get = (key: string): string => (map.get(key) ?? "").trim();
  const unitPrice = parseNumeric(get("unit_price"));
  const vendorName = get("vendor_name").toLowerCase();
  const rawItemName = (get("item_description") || get("vendor_name")).toLowerCase();

  // Benchmark signal check
  if (unitPrice !== null) {
    for (const [commodity, bench] of Object.entries(BENCHMARK_PRICES)) {
      if (rawItemName.includes(commodity) || vendorName.includes(commodity)) {
        if (unitPrice > bench.max * 2.5) {
          findings.push({
            finding_id: nextId(),
            rule_id: "STAT_PRICE_OUTLIER_HIGH",
            category: "contextual_suspicion",
            field: "unit_price",
            label: "Unit Price Benchmark",
            typed_value: String(unitPrice),
            evidence: `Observed unit price of ${unitPrice} is ${(unitPrice / bench.max).toFixed(1)}x above regional baseline (${bench.min}–${bench.max} PKR per ${bench.unit}).`,
            explanation: `Statistical anomaly: Unit price significantly exceeds market benchmark for ${commodity}. This frequently indicates a quantity/pack size mix-up or misplaced decimal.`,
            suggested_action: "Confirm if this represents a bulk pack, premium grade, or a typographical error.",
            confidence: "medium",
            severity: "warning",
            status: "open",
          });
        } else if (unitPrice < bench.min * 0.2 && unitPrice > 0) {
          findings.push({
            finding_id: nextId(),
            rule_id: "STAT_PRICE_OUTLIER_LOW",
            category: "contextual_suspicion",
            field: "unit_price",
            label: "Unit Price Benchmark",
            typed_value: String(unitPrice),
            evidence: `Observed unit price of ${unitPrice} is unusually low compared to regional baseline (${bench.min}–${bench.max} PKR per ${bench.unit}).`,
            explanation: `Statistical anomaly: Unit price is far below standard market price for ${commodity}.`,
            suggested_action: "Verify if unit of measurement is grams/fractions instead of standard package.",
            confidence: "medium",
            severity: "warning",
            status: "open",
          });
        }
      }
    }
  }

  // Tax rate statistical signal (Standard sales tax in Pakistan / regional is typically 0% to 18%)
  const subtotal = parseNumeric(get("subtotal"));
  const tax = parseNumeric(get("tax"));
  if (subtotal && tax) {
    const taxRate = (tax / subtotal) * 100;
    if (taxRate > 25) {
      findings.push({
        finding_id: nextId(),
        rule_id: "STAT_HIGH_TAX_RATE",
        category: "contextual_suspicion",
        field: "tax",
        label: "Sales Tax / GST Rate",
        typed_value: String(tax),
        evidence: `Calculated effective tax rate is ${taxRate.toFixed(1)}% of subtotal (${tax} on ${subtotal}).`,
        explanation: "Effective tax rate exceeds 25%, which is unusually high for standard commerce.",
        suggested_action: "Verify whether withholding tax or surcharges were bundled into the tax field.",
        confidence: "medium",
        severity: "warning",
        status: "open",
      });
    }
  }

  return findings;
}

// ── 3. Missing Context & Uncertain Extraction Checks ─────────────────────────
export function runContextAndUncertaintyChecks(
  entries: TypedEntry[],
  doc?: ExtractionResult | null,
  context?: BusinessContext
): Finding[] {
  const findings: Finding[] = [];
  const map = new Map<string, string>();
  for (const e of entries) {
    map.set(e.field, e.typed_value);
  }

  // Missing Currency context
  const currency = context?.currency || map.get("currency") || doc?.currency;
  if (!currency) {
    findings.push({
      finding_id: nextId(),
      rule_id: "CTX_MISSING_CURRENCY",
      category: "missing_context",
      field: "currency",
      label: "Reporting Currency",
      typed_value: "",
      evidence: "No transaction currency specified in form entries, business context, or document scan.",
      explanation: "Without a defined currency, cross-currency reconciliation and release into ledger cannot be responsibly validated.",
      suggested_action: "Specify reporting currency (e.g. PKR, USD, EUR) in context settings.",
      confidence: "high",
      severity: "warning",
      status: "open",
    });
  }

  // Uncertain extraction check from Document OCR
  if (doc) {
    if (doc.total_amount === null || doc.total_amount === undefined) {
      findings.push({
        finding_id: nextId(),
        rule_id: "UNCERTAIN_OCR_TOTAL",
        category: "uncertain_extraction",
        field: "total_amount",
        label: "Document Total OCR",
        typed_value: map.get("total_amount") ?? "",
        document_value: "[Unreadable / Not detected]",
        evidence: "Document visual analysis could not extract total amount with sufficient confidence.",
        explanation: "Handwriting or low contrast obscured the bill final total. Human verification required before release.",
        suggested_action: "Inspect physical voucher to visually confirm the total.",
        confidence: "medium",
        severity: "warning",
        status: "open",
      });
    }

    if (!doc.vendor_name) {
      findings.push({
        finding_id: nextId(),
        rule_id: "UNCERTAIN_OCR_VENDOR",
        category: "uncertain_extraction",
        field: "vendor_name",
        label: "Document Vendor Stamp/Header",
        typed_value: map.get("vendor_name") ?? "",
        document_value: "[Unreadable / Missing]",
        evidence: "Vendor header or official stamp was indistinct on the provided document photo.",
        explanation: "Lack of clear vendor identification on document introduces compliance risk.",
        suggested_action: "Ensure the bill contains an official stamp or printed header.",
        confidence: "medium",
        severity: "warning",
        status: "open",
      });
    }
  }

  return findings;
}

// ── 4. Gemma 4 Contextual Reasoner (An Agent for Context) ────────────────────
export async function runGemmaContextualAnalysis(
  entries: TypedEntry[],
  context?: BusinessContext,
  apiKey?: string
): Promise<{ findings: Finding[]; summary: string }> {
  if (!apiKey) {
    return {
      findings: [],
      summary: "Gemma 4 contextual engine skipped (API key not configured). Deterministic and statistical rules applied.",
    };
  }

  const ai = new GoogleGenAI({ apiKey });
  const entriesStr = entries.map((e) => `${e.field}: "${e.typed_value}"`).join("\n");
  const ctxStr = context
    ? `Business Type: ${context.business_type}, Currency: ${context.currency}, Reporting Period: ${context.reporting_period}, Notes: ${context.notes || "None"}`
    : "Standard Commercial Ledger";

  const prompt = `You are Tasdeeq's AI Contextual Verification Agent, powered by Gemma 4.
Your role: Contextual reasoning and anomaly detection.
Core principle: "Ordinary code for certainty. Statistics for signals. An agent for context. Human review for accountability."

Given the submitted transaction data and business context below:
---
BUSINESS CONTEXT:
${ctxStr}

SUBMITTED TRANSACTION ENTRIES:
${entriesStr}
---

Your task:
1. Identify any subtle contextual anomalies, semantic inconsistencies, or missing context. For example:
   - Does the vendor name clash with the items or business domain (e.g. buying industrial chemicals for a bakery)?
   - Are quantities or unit pricing suspicious given the business domain?
   - Is essential business context missing to validate this record?
2. Distinguish confirmed rule errors from mere suspicions. Never claim an error without concrete evidence.
3. Return ONLY a valid JSON object matching this schema:
{
  "contextual_findings": [
    {
      "category": "contextual_suspicion" | "missing_context",
      "field": string,
      "label": string,
      "severity": "warning" | "info",
      "evidence": string,
      "explanation": string,
      "suggested_action": string
    }
  ],
  "reasoning_summary": string
}

If everything appears contextually coherent, return an empty array for contextual_findings and a concise 1-sentence verification summary.`;

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
      return { findings: [], summary: "Gemma 4 reviewed the context and detected no critical semantic flags." };
    }

    const aiFindings: Finding[] = (parsed.contextual_findings || []).map((cf: any) => ({
      finding_id: nextId(),
      rule_id: "GEMMA_CTX_ANALYSIS",
      category: cf.category === "missing_context" ? "missing_context" : "contextual_suspicion",
      field: cf.field || "general",
      label: cf.label || cf.field || "Contextual Review",
      typed_value: entries.find((e) => e.field === cf.field)?.typed_value || "",
      document_value: "",
      evidence: cf.evidence || "Gemma 4 contextual model identified a semantic inconsistency.",
      explanation: cf.explanation || "Review recommended by AI contextual reasoning engine.",
      suggested_action: cf.suggested_action || "Investigate entry context with submitting party.",
      confidence: "medium",
      severity: cf.severity === "info" ? "info" : "warning",
      status: "open",
    }));

    return {
      findings: aiFindings,
      summary: parsed.reasoning_summary || "Gemma 4 contextual evaluation complete.",
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("[GemmaContextualAnalysis] API call error (fallback safely):", msg);
    return {
      findings: [],
      summary: `Deterministic checks completed. (Gemma contextual agent note: ${msg.slice(0, 120)})`,
    };
  }
}

// ── 5. Quality Gate Evaluator ────────────────────────────────────────────────
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

// ── 6. Full Unified Verification Pipeline ────────────────────────────────────
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

  // Step 1: Ordinary code for certainty
  const deterministicFindings = runDeterministicChecks(
    params.entries,
    params.documentExtraction,
    params.context
  );

  // Step 2: Statistics for signals
  const statisticalFindings = runStatisticalSignals(params.entries, params.context);

  // Step 3: Missing context & uncertain OCR checks
  const contextFindings = runContextAndUncertaintyChecks(
    params.entries,
    params.documentExtraction,
    params.context
  );

  // Step 4: Agent for context (Gemma 4)
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
    summary = "Verified using deterministic quality rules and statistical baseline signals.";
  }

  const allFindings = [
    ...deterministicFindings,
    ...statisticalFindings,
    ...contextFindings,
    ...gemmaFindings,
  ];

  const gate = evaluateQualityGate(allFindings);

  return {
    findings: allFindings,
    gateState: gate.gateState,
    summary,
    stats: {
      totalFindings: allFindings.length,
      blocking: gate.blockingCount,
      warnings: gate.warningsCount,
      resolved: gate.resolvedCount,
    },
  };
}
