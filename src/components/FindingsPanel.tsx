"use client";
import { useState } from "react";
import type { Finding } from "@/lib/types";

interface Props {
  findings: Finding[];
  onResolve: (
    id: string,
    resolution: "accepted_doc" | "kept_typed" | "edited",
    editedValue?: string
  ) => void;
}

const FIELD_LABELS: Record<string, string> = {
  vendor_name:    "Vendor / Shop Name",
  invoice_number: "Invoice / Bill #",
  date:           "Date",
  total_amount:   "Total Amount",
  quantity:       "Quantity",
  unit_price:     "Unit Price",
  subtotal:       "Subtotal",
  line_item_subtotal: "Line Items Subtotal",
};

function StatusChip({ status }: { status: Finding["status"] }) {
  const map: Record<Finding["status"], { cls: string; label: string }> = {
    open:         { cls: "chip--open",    label: "Open" },
    accepted_doc: { cls: "chip--doc",     label: "Used document value" },
    kept_typed:   { cls: "chip--typed",   label: "Kept typed value" },
    edited:       { cls: "chip--edited",  label: "Manually edited" },
  };
  const { cls, label } = map[status];
  return <span className={`chip ${cls}`}>{label}</span>;
}

function FindingCard({ finding, onResolve }: { finding: Finding; onResolve: Props["onResolve"] }) {
  const [editVal, setEditVal] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const resolved = finding.status !== "open";

  return (
    <div className={`finding-card finding-card--${finding.severity} ${resolved ? "finding-card--resolved" : ""} animate-in`}>
      <div className="finding-card__top">
        <div>
          <div className="finding-card__field">{FIELD_LABELS[finding.field] ?? finding.field}</div>
          <div className="finding-card__id">{finding.rule_id} · {finding.finding_id}</div>
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <span className={`sev-chip sev-chip--${finding.severity}`}>{finding.severity}</span>
          <StatusChip status={finding.status} />
        </div>
      </div>

      <div className="finding-card__values">
        <div className="value-box value-box--typed">
          <div className="value-box__label">Your typed value</div>
          <div className="value-box__val">{finding.typed_value || "—"}</div>
        </div>
        <div className="value-box value-box--doc">
          <div className="value-box__label">Document says (Gemma)</div>
          <div className="value-box__val">{finding.document_value || "—"}</div>
        </div>
      </div>

      <div className="finding-card__evidence">{finding.evidence}</div>

      {!resolved && (
        <>
          <div className="resolution-row">
            <button
              className="btn btn--success btn--sm"
              onClick={() => onResolve(finding.finding_id, "accepted_doc")}
              id={`btn-accept-doc-${finding.finding_id}`}
            >
              ✓ Use document value
            </button>
            <button
              className="btn btn--warning btn--sm"
              onClick={() => onResolve(finding.finding_id, "kept_typed")}
              id={`btn-keep-typed-${finding.finding_id}`}
            >
              ↺ Keep my typed value
            </button>
            <button
              className="btn btn--ghost btn--sm"
              onClick={() => { setShowEdit((s) => !s); setEditVal(""); }}
              id={`btn-edit-${finding.finding_id}`}
            >
              ✏ Edit manually
            </button>
          </div>
          {showEdit && (
            <div className="resolution-edit-row">
              <input
                className="table-input"
                type="text"
                placeholder="Enter corrected value…"
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
                id={`input-edit-${finding.finding_id}`}
                aria-label="Manually edited value"
              />
              <button
                className="btn btn--primary btn--sm"
                disabled={!editVal.trim()}
                onClick={() => { onResolve(finding.finding_id, "edited", editVal); setShowEdit(false); }}
                id={`btn-confirm-edit-${finding.finding_id}`}
              >
                Save
              </button>
            </div>
          )}
        </>
      )}

      {resolved && finding.resolved_value && (
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
          Final value: <strong style={{ color: "var(--text-secondary)" }}>{finding.resolved_value}</strong>
        </div>
      )}
    </div>
  );
}

export default function FindingsPanel({ findings, onResolve }: Props) {
  if (findings.length === 0) {
    return (
      <div className="findings-empty">
        <div className="findings-empty__icon">✅</div>
        <div className="findings-empty__text">No mismatches found — all entries match the document.</div>
      </div>
    );
  }

  return (
    <div>
      {findings.map((f) => (
        <FindingCard key={f.finding_id} finding={f} onResolve={onResolve} />
      ))}
    </div>
  );
}
