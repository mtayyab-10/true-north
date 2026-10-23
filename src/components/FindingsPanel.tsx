"use client";
import { useState } from "react";
import type { Finding, FindingCategory, FindingStatus } from "@/lib/types";

interface Props {
  findings: Finding[];
  onResolve: (
    id: string,
    resolution: FindingStatus,
    editedValue?: string,
    reason?: string
  ) => void;
}

const FIELD_LABELS: Record<string, string> = {
  vendor_name: "Vendor Name",
  invoice_number: "Invoice Number",
  date: "Date",
  total_amount: "Total Amount",
  quantity: "Quantity",
  unit_price: "Unit Price",
  subtotal: "Subtotal",
  tax: "Sales Tax / GST",
  currency: "Currency",
  item_description: "Item Description",
};

const CATEGORY_META: Record<
  FindingCategory,
  { label: string; badgeCls: string; description: string }
> = {
  rule_violation: {
    label: "Rule Violation",
    badgeCls: "badge--violation",
    description: "Deterministic check established a defined rule failure.",
  },
  contextual_suspicion: {
    label: "Contextual Suspicion",
    badgeCls: "badge--suspicion",
    description: "AI or statistical benchmark signal identified an anomaly.",
  },
  uncertain_extraction: {
    label: "Uncertain Extraction",
    badgeCls: "badge--uncertain",
    description: "Value cannot be read or verified with high visual confidence.",
  },
  missing_context: {
    label: "Missing Context",
    badgeCls: "badge--missing",
    description: "Essential business or reporting context is missing.",
  },
};

function StatusBadge({ status }: { status: FindingStatus }) {
  const map: Record<string, { cls: string; label: string }> = {
    open: { cls: "status-open", label: "Open" },
    resolved_accepted: { cls: "status-resolved", label: "Accepted Exception" },
    accepted_doc: { cls: "status-resolved", label: "Used Document Value" },
    resolved_corrected: { cls: "status-resolved", label: "Corrected Value" },
    edited: { cls: "status-resolved", label: "Corrected Value" },
    kept_typed: { cls: "status-resolved", label: "Kept Value" },
    dismissed: { cls: "status-dismissed", label: "Dismissed" },
  };
  const item = map[status] || { cls: "status-open", label: status };
  return <span className={`audit-badge ${item.cls}`}>{item.label}</span>;
}

function FindingItem({
  finding,
  onResolve,
}: {
  finding: Finding;
  onResolve: Props["onResolve"];
}) {
  const [showEdit, setShowEdit] = useState(false);
  const [showAccept, setShowAccept] = useState(false);
  const [showDismiss, setShowDismiss] = useState(false);
  const [editVal, setEditVal] = useState(finding.typed_value || "");
  const [reasonVal, setReasonVal] = useState("");
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const isResolved = finding.status !== "open";
  const cat = CATEGORY_META[finding.category] || CATEGORY_META.rule_violation;
  const isBlocking = finding.severity === "blocking" || finding.severity === "high";

  return (
    <div
      className={`finding-card ${
        isBlocking ? "finding-card--blocking" : "finding-card--warning"
      } ${isResolved ? "finding-card--resolved" : ""} animate-in`}
      id={`card-${finding.finding_id}`}
    >
      <div className="finding-card__top">
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span className={`category-pill ${cat.badgeCls}`}>
              {cat.label}
            </span>
            <span className={`sev-chip sev-chip--${finding.severity}`}>
              {isBlocking ? "Blocking" : "Warning"}
            </span>
          </div>
          <div className="finding-card__field">
            {finding.label || FIELD_LABELS[finding.field] || finding.field}
          </div>
          <div className="finding-card__id">
            Rule: {finding.rule_id} · ID: {finding.finding_id}
          </div>
        </div>
        <StatusBadge status={finding.status} />
      </div>

      {/* Values Comparison Grid */}
      <div className="finding-card__values">
        <div className="value-box">
          <div className="value-box__label">Observed / Submitted Value</div>
          <div className="value-box__val">{finding.typed_value || "—"}</div>
        </div>
        {(finding.document_value || finding.expected_value) && (
          <div className="value-box">
            <div className="value-box__label">
              {finding.document_value ? "Document / Scan Reference" : "Expected Value"}
            </div>
            <div className="value-box__val" style={{ color: "var(--accent)" }}>
              {finding.document_value || finding.expected_value}
            </div>
          </div>
        )}
      </div>

      {/* Evidence & Explanation Box */}
      <div className="finding-evidence-block">
        <div className="evidence-header">
          <strong>Evidence:</strong> {finding.evidence}
        </div>
        {finding.explanation && (
          <div className="explanation-body">
            <strong>Context Analysis:</strong> {finding.explanation}
          </div>
        )}
        {finding.suggested_action && (
          <div className="action-body">
            <strong>Action:</strong> {finding.suggested_action}
          </div>
        )}
      </div>

      {/* Resolution Actions */}
      {!isResolved && (
        <div className="resolution-section">
          <div className="resolution-row">
            {finding.document_value && (
              <button
                className="btn btn--success btn--sm"
                onClick={() =>
                  onResolve(
                    finding.finding_id,
                    "resolved_accepted",
                    finding.document_value,
                    "Adopted verified document value"
                  )
                }
                id={`btn-adopt-doc-${finding.finding_id}`}
              >
                Adopt Document Value ({finding.document_value})
              </button>
            )}

            <button
              className="btn btn--secondary btn--sm"
              onClick={() => {
                setShowEdit(!showEdit);
                setShowAccept(false);
                setShowDismiss(false);
              }}
              id={`btn-edit-${finding.finding_id}`}
            >
              Correct Value
            </button>

            <button
              className="btn btn--warning btn--sm"
              onClick={() => {
                setShowAccept(!showAccept);
                setShowEdit(false);
                setShowDismiss(false);
              }}
              id={`btn-accept-exc-${finding.finding_id}`}
            >
              Accept Exception
            </button>

            {!isBlocking && (
              <button
                className="btn btn--ghost btn--sm"
                onClick={() => {
                  setShowDismiss(!showDismiss);
                  setShowEdit(false);
                  setShowAccept(false);
                }}
                id={`btn-dismiss-${finding.finding_id}`}
              >
                Dismiss
              </button>
            )}
          </div>

          {/* Edit Value Form */}
          {showEdit && (
            <div className="resolution-form animate-in">
              <label className="resolution-form__label">Corrected Value:</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  className="table-input"
                  type="text"
                  value={editVal}
                  onChange={(e) => setEditVal(e.target.value)}
                  placeholder="Enter corrected value"
                  id={`input-correct-${finding.finding_id}`}
                />
                <button
                  className="btn btn--primary btn--sm"
                  disabled={!editVal.trim()}
                  onClick={() => {
                    onResolve(
                      finding.finding_id,
                      "resolved_corrected",
                      editVal.trim(),
                      "User corrected manual typo"
                    );
                    setShowEdit(false);
                  }}
                  id={`btn-save-edit-${finding.finding_id}`}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          {/* Accept Exception with Reason */}
          {showAccept && (
            <div className="resolution-form animate-in">
              <label className="resolution-form__label">
                Required Justification for Policy Exception:
              </label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  className="table-input"
                  type="text"
                  value={reasonVal}
                  onChange={(e) => setReasonVal(e.target.value)}
                  placeholder="e.g. Special negotiated bulk discount approved"
                  id={`input-reason-accept-${finding.finding_id}`}
                />
                <button
                  className="btn btn--warning btn--sm"
                  disabled={!reasonVal.trim()}
                  onClick={() => {
                    onResolve(
                      finding.finding_id,
                      "resolved_accepted",
                      finding.typed_value,
                      reasonVal.trim()
                    );
                    setShowAccept(false);
                  }}
                  id={`btn-confirm-accept-${finding.finding_id}`}
                >
                  Confirm Exception
                </button>
              </div>
            </div>
          )}

          {/* Dismiss Finding */}
          {showDismiss && (
            <div className="resolution-form animate-in">
              <label className="resolution-form__label">Reason for Dismissal:</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  className="table-input"
                  type="text"
                  value={reasonVal}
                  onChange={(e) => setReasonVal(e.target.value)}
                  placeholder="e.g. Non-critical variation"
                  id={`input-reason-dismiss-${finding.finding_id}`}
                />
                <button
                  className="btn btn--ghost btn--sm"
                  disabled={!reasonVal.trim()}
                  onClick={() => {
                    onResolve(
                      finding.finding_id,
                      "dismissed",
                      finding.typed_value,
                      reasonVal.trim()
                    );
                    setShowDismiss(false);
                  }}
                  id={`btn-confirm-dismiss-${finding.finding_id}`}
                >
                  Dismiss Finding
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Resolved State & Audit Trail */}
      {isResolved && (
        <div className="resolved-summary">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
              Resolved as: <strong style={{ color: "var(--accent)" }}>{finding.resolved_value || finding.typed_value}</strong>
              {finding.resolution_reason && (
                <span style={{ marginLeft: "6px", color: "var(--text-muted)" }}>
                  — &quot;{finding.resolution_reason}&quot;
                </span>
              )}
            </span>
            <button
              onClick={() => setShowAuditTrail(!showAuditTrail)}
              style={{ fontSize: "12px", color: "var(--accent)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
            >
              {showAuditTrail ? "Hide Audit History" : "View Audit History"}
            </button>
          </div>

          {showAuditTrail && (
            <div style={{ marginTop: "8px", paddingTop: "8px", borderTop: "1px solid var(--border)", fontSize: "11px", color: "var(--text-muted)" }}>
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>Audit History:</div>
              {finding.audit_trail && finding.audit_trail.length > 0 ? (
                finding.audit_trail.map((entry: any, i: number) => (
                  <div key={i} style={{ padding: "2px 0" }}>
                    <span>{new Date(entry.timestamp).toLocaleTimeString()}</span> ·{" "}
                    <strong>{entry.status}</strong>: {entry.reason || "Updated"}{" "}
                    (Value: {entry.resolved_value})
                  </div>
                ))
              ) : (
                <div>{finding.resolution_reason || "Resolved by reviewer."}</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function FindingsPanel({ findings, onResolve }: Props) {
  const [activeFilter, setActiveFilter] = useState<string>("all");

  const categories: FindingCategory[] = [
    "rule_violation",
    "contextual_suspicion",
    "uncertain_extraction",
    "missing_context",
  ];

  const filtered =
    activeFilter === "all"
      ? findings
      : findings.filter((f) => f.category === activeFilter);

  const getCategoryCount = (cat: string) =>
    findings.filter((f) => f.category === cat).length;

  if (findings.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 16px", background: "var(--bg-elevated)", borderRadius: "var(--r-md)" }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: "var(--accent)", marginBottom: "4px" }}>
          No Discrepancies Detected
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>
          All entries conform to deterministic checks, statistical baselines, and contextual validation.
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Category Filter Tabs */}
      <div className="findings-filters">
        <button
          className={`filter-btn ${activeFilter === "all" ? "filter-btn--active" : ""}`}
          onClick={() => setActiveFilter("all")}
        >
          All Findings ({findings.length})
        </button>
        {categories.map((catKey) => {
          const count = getCategoryCount(catKey);
          if (count === 0) return null;
          const meta = CATEGORY_META[catKey];
          return (
            <button
              key={catKey}
              className={`filter-btn ${
                activeFilter === catKey ? "filter-btn--active" : ""
              }`}
              onClick={() => setActiveFilter(catKey)}
            >
              {meta.label} ({count})
            </button>
          );
        })}
      </div>

      {/* Finding Items List */}
      <div>
        {filtered.map((f) => (
          <FindingItem key={f.finding_id} finding={f} onResolve={onResolve} />
        ))}
      </div>
    </div>
  );
}
