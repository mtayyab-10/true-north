import type { ExtractionResult, TypedEntry, Finding, Rule, Severity } from "./types";
import rulesRaw from "../../data/rules.json";

const rules: Rule[] = (rulesRaw as { rules: Rule[] }).rules;

function numericStr(s: string): number | null {
  const n = parseFloat(s.replace(/[,،\s]/g, "").replace(/[^0-9.\-]/g, ""));
  return isNaN(n) ? null : n;
}

function confidence(docVal: string | number | undefined): Finding["confidence"] {
  if (docVal === undefined || docVal === null || docVal === "") return "low";
  if (typeof docVal === "number") return "high";
  if (docVal.toString().trim().length > 0) return "high";
  return "medium";
}

let findingCounter = 0;
function newId() {
  return `F${String(++findingCounter).padStart(3, "0")}`;
}

// ── Core check dispatch ───────────────────────────────────────────────────────
function runCheck(
  rule: Rule,
  typedVal: string,
  docVal: string,
  evidence: string,
  conf: Finding["confidence"]
): Finding | null {
  let mismatch = false;

  switch (rule.check_type) {
    case "equals":
      mismatch = typedVal.trim() !== docVal.trim();
      break;
    case "equals_ci":
      mismatch = typedVal.trim().toLowerCase() !== docVal.trim().toLowerCase();
      break;
    case "within_tolerance": {
      const t = numericStr(typedVal);
      const d = numericStr(docVal);
      if (t === null || d === null) mismatch = true;
      else mismatch = Math.abs(t - d) > (rule.tolerance ?? 0);
      break;
    }
    case "sum_matches": {
      const t = numericStr(typedVal);
      const d = numericStr(docVal);
      if (t === null || d === null) mismatch = true;
      else mismatch = Math.abs(t - d) > (rule.tolerance ?? 0.5);
      break;
    }
    default:
      mismatch = false;
  }

  if (!mismatch) return null;

  return {
    finding_id: newId(),
    rule_id: rule.rule_id,
    field: rule.field,
    typed_value: typedVal,
    document_value: docVal,
    evidence,
    confidence: conf,
    severity: rule.severity,
    status: "open",
  };
}

// ── Main comparison function ──────────────────────────────────────────────────
export function compareEntries(
  extraction: ExtractionResult,
  typedEntries: TypedEntry[]
): Finding[] {
  findingCounter = 0;
  const findings: Finding[] = [];

  const getTyped = (field: string): TypedEntry | undefined =>
    typedEntries.find((e) => e.field === field);

  for (const rule of rules) {
    const typed = getTyped(rule.field);
    if (!typed) continue; // no typed entry for this field → skip

    let docVal = "";
    let evidence = "";

    switch (rule.field) {
      case "total_amount":
        docVal = extraction.total_amount?.toString() ?? "";
        evidence = `Document total: ${extraction.total_amount ?? "not found"}`;
        break;
      case "subtotal":
      case "line_item_subtotal":
        docVal = extraction.subtotal?.toString() ?? "";
        evidence = `Document subtotal: ${extraction.subtotal ?? "not found"}`;
        break;
      case "invoice_number":
        docVal = extraction.invoice_number ?? "";
        evidence = `Invoice # on document: ${extraction.invoice_number ?? "not found"}`;
        break;
      case "vendor_name":
        docVal = extraction.vendor_name ?? "";
        evidence = `Vendor on document: ${extraction.vendor_name ?? "not found"}`;
        break;
      case "date":
        docVal = extraction.date ?? "";
        evidence = `Date on document: ${extraction.date ?? "not found"}`;
        break;
      case "quantity": {
        // match first line item quantity
        const qty = extraction.line_items?.[0]?.quantity;
        docVal = qty?.toString() ?? "";
        evidence = `Quantity on first line item: ${qty ?? "not found"}`;
        break;
      }
      case "unit_price": {
        const up = extraction.line_items?.[0]?.unit_price;
        docVal = up?.toString() ?? "";
        evidence = `Unit price on first line item: ${up ?? "not found"}`;
        break;
      }
      default:
        continue;
    }

    const conf = confidence(docVal);
    const finding = runCheck(rule, typed.typed_value, docVal, evidence, conf);
    if (finding) findings.push(finding);
  }

  return findings;
}

// ── Resolution helper ─────────────────────────────────────────────────────────
export function resolveFinding(
  finding: Finding,
  resolution: "accepted_doc" | "kept_typed" | "edited",
  editedValue?: string
): Finding {
  return {
    ...finding,
    status: resolution,
    resolved_value:
      resolution === "accepted_doc"
        ? finding.document_value
        : resolution === "kept_typed"
        ? finding.typed_value
        : editedValue ?? finding.typed_value,
  };
}

export function allResolved(findings: Finding[]): boolean {
  return findings.every((f) => f.status !== "open");
}
