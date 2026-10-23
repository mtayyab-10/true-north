"use client";
import { useState } from "react";
import type { Finding, TypedEntry, BusinessContext, ReleaseRecord, QualityGateState } from "@/lib/types";

interface Props {
  findings: Finding[];
  typedEntries: TypedEntry[];
  context?: BusinessContext;
  sessionId?: string;
  onReleased?: (record: ReleaseRecord) => void;
}

export default function ExportGate({
  findings,
  typedEntries,
  context,
  sessionId,
  onReleased,
}: Props) {
  const [isReleasing, setIsReleasing] = useState(false);
  const [releaseRecord, setReleaseRecord] = useState<ReleaseRecord | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const openFindings = findings.filter((f) => f.status === "open");
  const openBlocking = openFindings.filter(
    (f) => f.severity === "blocking" || f.severity === "high"
  );
  const openWarnings = openFindings.filter(
    (f) => f.severity === "warning" || f.severity === "medium"
  );

  let gateState: QualityGateState = "ready_for_release";
  if (releaseRecord) {
    gateState = "released";
  } else if (openBlocking.length > 0) {
    gateState = "blocked";
  } else if (openWarnings.length > 0) {
    gateState = "needs_review";
  }

  // Execute Server-side Quality Gate Release
  const handleRelease = async () => {
    setIsReleasing(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: typedEntries,
          findings,
          context,
          sessionId,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Release rejected by quality gate.");
      }

      setReleaseRecord(json.releaseRecord);
      if (onReleased) onReleased(json.releaseRecord);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
    } finally {
      setIsReleasing(false);
    }
  };

  // Download Verified CSV
  const downloadCSV = () => {
    const rows = [
      ["field", "typed_value", "resolved_value", "status", "category", "audit_reason"],
      ...typedEntries.map((e) => {
        const f = findings.find((fi) => fi.field === e.field);
        return [
          e.field,
          e.typed_value,
          f?.resolved_value ?? e.typed_value,
          f?.status ?? "verified_no_finding",
          f?.category ?? "clean",
          f?.resolution_reason ?? "N/A",
        ];
      }),
    ];
    const csvContent = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `truenorth_verified_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Download Full Audit JSON
  const downloadJSON = () => {
    const bundle = {
      release_record: releaseRecord,
      verified_entries: typedEntries,
      audit_findings: findings,
      context,
      verified_by: "TrueNorth Pre-Submission Quality Engine",
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `truenorth_release_${releaseRecord?.release_id || Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={`quality-gate-panel quality-gate-panel--${gateState} animate-in`}>
      {/* Quality Gate Status Header */}
      <div className="quality-gate-header">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "var(--r-md)", background: gateState === "released" || gateState === "ready_for_release" ? "var(--accent-dim)" : "rgba(196, 93, 62, 0.12)", color: gateState === "released" || gateState === "ready_for_release" ? "var(--accent)" : "var(--sev-high)" }}>
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2">
            {gateState === "released" && <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>}
            {gateState === "ready_for_release" && <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>}
            {gateState === "needs_review" && <circle cx="12" cy="12" r="10"></circle>}
            {gateState === "blocked" && <circle cx="12" cy="12" r="10"></circle>}
          </svg>
        </div>
        <div>
          <div className="quality-gate-status-title">
            {gateState === "released" && "Data Formally Verified & Released"}
            {gateState === "ready_for_release" && "Quality Gate: Ready for Release"}
            {gateState === "needs_review" && "Quality Gate: Advisory Review Required"}
            {gateState === "blocked" && "Quality Gate: Release Blocked"}
          </div>
          <div className="quality-gate-status-sub">
            {gateState === "released" &&
              `Release ID: ${releaseRecord?.release_id} · Timestamp: ${releaseRecord?.timestamp}`}
            {gateState === "ready_for_release" &&
              "All blocking verification checks satisfied. Authorization to release granted."}
            {gateState === "needs_review" &&
              `${openWarnings.length} non-blocking warning(s) remain open. You may review them or proceed with release.`}
            {gateState === "blocked" &&
              `${openBlocking.length} blocking rule violation(s) must be corrected or resolved before release into downstream systems.`}
          </div>
        </div>
      </div>

      {/* Blocked Explanation Alert */}
      {gateState === "blocked" && (
        <div className="gate-alert gate-alert--blocked">
          <strong>Enforcement Active:</strong> Downstream release or submission is strictly
          forbidden until all high-severity errors (such as arithmetic mismatches or
          unresolved document discrepancies) are investigated and corrected.
        </div>
      )}

      {errorMsg && (
        <div className="gate-alert gate-alert--blocked">
          <strong>Server Rejection:</strong> {errorMsg}
        </div>
      )}

      {/* Release Record Certificate */}
      {releaseRecord && (
        <div className="release-certificate animate-in">
          <div className="cert-header">
            <span>Official TrueNorth Quality Seal</span>
            <span className="cert-hash">SHA-256: {releaseRecord.verification_checksum.slice(0, 16)}…</span>
          </div>
          <div className="cert-body">
            <div>
              <strong>Release ID:</strong> {releaseRecord.release_id}
            </div>
            <div>
              <strong>Verified At:</strong> {new Date(releaseRecord.timestamp).toLocaleString()}
            </div>
            <div>
              <strong>Entries Verified:</strong> {releaseRecord.total_entries}
            </div>
            <div>
              <strong>Findings Resolved:</strong> {releaseRecord.resolved_findings}
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="quality-gate-actions" style={{ marginTop: "16px" }}>
        {gateState !== "released" ? (
          <button
            className={`btn btn--lg ${
              gateState === "blocked" ? "btn--blocked" : "btn--primary"
            }`}
            onClick={handleRelease}
            disabled={gateState === "blocked" || isReleasing}
            id="btn-release-gate"
          >
            {isReleasing
              ? "Verifying Server Quality Gate…"
              : gateState === "blocked"
              ? "Release Blocked by Quality Gate"
              : "Authorize & Release Data"}
          </button>
        ) : (
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
            <button className="btn btn--primary" onClick={downloadCSV} id="btn-download-csv">
              Download Verified CSV
            </button>
            <button className="btn btn--secondary" onClick={downloadJSON} id="btn-download-json">
              Download Audit Bundle (JSON)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
