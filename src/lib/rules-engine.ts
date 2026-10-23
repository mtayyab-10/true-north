import type { ExtractionResult, TypedEntry, Finding, FindingStatus } from "./types";
import { runDeterministicChecks, evaluateQualityGate } from "./verification-engine";

// ── Backward-compatible comparison function ──────────────────────────────────
export function compareEntries(
  extraction: ExtractionResult,
  typedEntries: TypedEntry[]
): Finding[] {
  return runDeterministicChecks(typedEntries, extraction);
}

// ── Enhanced Resolution helper with reasons and audit trail ──────────────────
export function resolveFinding(
  finding: Finding,
  resolution: FindingStatus,
  editedValue?: string,
  reason?: string
): Finding {
  let finalVal = finding.typed_value;
  if (resolution === "accepted_doc" || resolution === "resolved_accepted") {
    finalVal = finding.document_value || finding.expected_value || finding.typed_value;
  } else if (resolution === "edited" || resolution === "resolved_corrected") {
    finalVal = editedValue ?? finding.typed_value;
  } else if (resolution === "dismissed") {
    finalVal = finding.typed_value;
  }

  const newAudit = {
    status: resolution,
    timestamp: new Date().toISOString(),
    reason: reason || (resolution === "accepted_doc" ? "Adopted document value" : resolution === "dismissed" ? "Dismissed as false positive or non-issue" : "Corrected value"),
    previous_value: finding.typed_value,
    resolved_value: finalVal,
  };

  const auditHistory = finding.audit_trail ? [...finding.audit_trail, newAudit] : [newAudit];

  return {
    ...finding,
    status: resolution,
    resolved_value: finalVal,
    resolution_reason: reason,
    audit_trail: auditHistory,
  };
}

export function allResolved(findings: Finding[]): boolean {
  const gate = evaluateQualityGate(findings);
  return gate.gateState === "ready_for_release";
}
