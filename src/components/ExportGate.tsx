"use client";
import type { Finding } from "@/lib/types";

interface Props {
  findings: Finding[];
  allResolved: boolean;
  onExport: () => void;
}

export default function ExportGate({ findings, allResolved, onExport }: Props) {
  const openCount = findings.filter((f) => f.status === "open").length;
  const hasFindings = findings.length > 0;

  return (
    <div className="export-gate animate-in">
      <div className="export-gate__icon">{allResolved || !hasFindings ? "🔓" : "🔒"}</div>
      <div className="export-gate__title">
        {allResolved || !hasFindings ? "Ready to export" : "Export blocked"}
      </div>
      <p className="export-gate__text">
        {allResolved || !hasFindings
          ? "All findings are resolved. Export the verified batch as CSV."
          : `Resolve all open findings before releasing this batch. ${openCount} finding${openCount !== 1 ? "s" : ""} still open.`}
      </p>

      {openCount > 0 && (
        <div className="export-gate__blocked">
          <span>🔒</span>
          <span>
            {openCount} unresolved finding{openCount !== 1 ? "s" : ""} must be reviewed before export.
            Every finding must be accepted, kept or manually corrected.
          </span>
        </div>
      )}

      <button
        className="btn btn--primary btn--lg"
        onClick={onExport}
        disabled={!allResolved && hasFindings}
        id="btn-export"
      >
        ⬇ Export Verified CSV
      </button>
    </div>
  );
}
