"use client";

import { useState, useCallback } from "react";
import type { BatchState, Finding, TypedEntry, ExtractionResult } from "@/lib/types";
import { compareEntries, resolveFinding, allResolved } from "@/lib/rules-engine";
import { DEMO_EXTRACTION, DEMO_TYPED_ENTRIES } from "@/lib/demo-cache";

import Uploader from "@/components/Uploader";
import EntryTable from "@/components/EntryTable";
import FindingsPanel from "@/components/FindingsPanel";
import ExportGate from "@/components/ExportGate";

const DEFAULT_ENTRIES: TypedEntry[] = [
  { id: "e1", field: "vendor_name",    typed_value: "" },
  { id: "e2", field: "invoice_number", typed_value: "" },
  { id: "e3", field: "date",           typed_value: "" },
  { id: "e4", field: "total_amount",   typed_value: "" },
  { id: "e5", field: "quantity",       typed_value: "" },
  { id: "e6", field: "unit_price",     typed_value: "" },
];

type Step = "upload" | "compare" | "resolve" | "export";

export default function HomePage() {
  const [step, setStep] = useState<Step>("upload");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [imageMime, setImageMime] = useState<string>("image/jpeg");
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const [typedEntries, setTypedEntries] = useState<TypedEntry[]>(DEFAULT_ENTRIES);
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null);
  const [findings, setFindings] = useState<Finding[]>([]);
  const [summary, setSummary] = useState<string | null>(null);

  const [isExtracting, setIsExtracting] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summaryLang, setSummaryLang] = useState<"en" | "ur">("en");
  const [error, setError] = useState<string | null>(null);
  const [usedDemo, setUsedDemo] = useState(false);

  // ── Image upload handler ──────────────────────────────────────────────────
  const handleImageSelect = useCallback((base64: string, mime: string, preview: string) => {
    setImageBase64(base64);
    setImageMime(mime);
    setImagePreview(preview);
    setError(null);
    setExtraction(null);
    setFindings([]);
    setSummary(null);
    setStep("upload");
  }, []);

  // ── Load demo mode ────────────────────────────────────────────────────────
  const loadDemo = () => {
    setTypedEntries(DEMO_TYPED_ENTRIES);
    setExtraction(DEMO_EXTRACTION);
    setImagePreview(null);
    setUsedDemo(true);
    const found = compareEntries(DEMO_EXTRACTION, DEMO_TYPED_ENTRIES);
    setFindings(found);
    setStep("resolve");
  };

  // ── Step 1 → 2: Extract with Gemma ───────────────────────────────────────
  const handleExtract = async () => {
    if (!imageBase64) return;
    setIsExtracting(true);
    setError(null);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: imageMime }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Extraction failed");
      }

      const ext: ExtractionResult = json.data;
      setExtraction(ext);
      setStep("compare");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setIsExtracting(false);
    }
  };

  // ── Step 2 → 3: Compare entries ──────────────────────────────────────────
  const handleCompare = () => {
    if (!extraction) return;
    const found = compareEntries(extraction, typedEntries);
    setFindings(found);
    setStep("resolve");
  };

  // ── Resolve a finding ─────────────────────────────────────────────────────
  const handleResolve = (
    findingId: string,
    resolution: "accepted_doc" | "kept_typed" | "edited",
    editedValue?: string
  ) => {
    setFindings((prev) =>
      prev.map((f) =>
        f.finding_id === findingId ? resolveFinding(f, resolution, editedValue) : f
      )
    );
  };

  // ── Get Gemma summary ─────────────────────────────────────────────────────
  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings, language: summaryLang }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Summary failed");
      setSummary(json.summary);
    } catch (err: unknown) {
      setSummary("⚠ Could not generate summary: " + (err instanceof Error ? err.message : "Unknown"));
    } finally {
      setIsSummarizing(false);
    }
  };

  // ── Export CSV ────────────────────────────────────────────────────────────
  const handleExport = () => {
    const rows = [
      ["field", "typed_value", "resolved_value", "status"],
      ...typedEntries.map((e) => {
        const f = findings.find((fi) => fi.field === e.field);
        return [
          e.field,
          e.typed_value,
          f?.resolved_value ?? e.typed_value,
          f?.status ?? "no_finding",
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasdeeq_batch_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const canCompare = step === "compare" && extraction !== null;
  const allDone = findings.length > 0 && allResolved(findings);
  const openCount = findings.filter((f) => f.status === "open").length;

  // ── Steps indicator ───────────────────────────────────────────────────────
  const steps = [
    { id: "upload",  label: "Upload" },
    { id: "compare", label: "Verify" },
    { id: "resolve", label: "Resolve" },
    { id: "export",  label: "Export" },
  ] as const;

  const stepIndex = (s: Step) => steps.findIndex((st) => st.id === s);

  return (
    <div className="page-shell">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo glow-pulse">ت</div>
          <div>
            <span className="topbar__title">Tasdeeq</span>
            <span className="topbar__sub">تصدیق</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div className="steps">
            {steps.map((s, i) => {
              const si = stepIndex(step);
              const cls = i < si ? "done" : i === si ? "active" : "";
              return (
                <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                  <div className={`step ${cls}`}>
                    <div className="step__dot">{i < si ? "✓" : i + 1}</div>
                    <span className="step__label">{s.label}</span>
                  </div>
                  {i < steps.length - 1 && <div className="step__line" />}
                </div>
              );
            })}
          </div>
          <span className="topbar__badge">Gemma 4 · 26B</span>
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <main className="main-content">

        {/* Hero tagline */}
        <div style={{ textAlign: "center", paddingBottom: "8px" }}>
          <h1 style={{ fontSize: "28px", fontWeight: 700, marginBottom: "8px", letterSpacing: "-0.5px" }}>
            Catch wrong numbers <span style={{ color: "var(--accent)" }}>before they cost you.</span>
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "15px", maxWidth: "560px", margin: "0 auto" }}>
            Upload a photo of a bill, ledger or invoice. Gemma reads the numbers.
            You review what doesn&apos;t match.
          </p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="alert alert--error animate-in">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Step 1: Upload + Entry Table ────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Upload */}
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">📄</div>
                Document Photo
              </div>
              <span className="card__badge badge--step">Step 1</span>
            </div>
            <Uploader
              onImageSelect={handleImageSelect}
              preview={imagePreview}
            />
            {imageBase64 && !isExtracting && step === "upload" && (
              <div style={{ marginTop: "16px" }}>
                <button
                  className="btn btn--primary btn--lg"
                  style={{ width: "100%" }}
                  onClick={handleExtract}
                  id="btn-extract"
                >
                  <span>✨</span> Extract with Gemma 4
                </button>
              </div>
            )}
            {isExtracting && (
              <div className="loading-overlay">
                <div className="spinner" />
                <span>Gemma is reading the document&hellip;</span>
              </div>
            )}
            {!imageBase64 && !usedDemo && (
              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <button className="btn btn--ghost btn--sm" onClick={loadDemo} id="btn-demo">
                  ⚡ Load demo sample
                </button>
              </div>
            )}
            {usedDemo && (
              <div className="alert alert--info animate-in" style={{ marginTop: "12px" }}>
                <span>ℹ</span>
                <span>Demo mode: pre-cached extraction loaded. 2 planted errors await discovery.</span>
              </div>
            )}
          </div>

          {/* Entry Table */}
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">⌨️</div>
                Typed Entries
              </div>
              <span className="card__badge badge--step">Step 2</span>
            </div>
            <EntryTable
              entries={typedEntries}
              onChange={setTypedEntries}
            />
            {canCompare && (
              <div style={{ marginTop: "16px" }}>
                <button
                  className="btn btn--primary"
                  style={{ width: "100%" }}
                  onClick={handleCompare}
                  id="btn-compare"
                >
                  🔍 Find Mismatches
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Extraction preview */}
        {extraction && (
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">🔎</div>
                What Gemma Read
              </div>
              <span className="card__badge badge--done">Extracted</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
              {[
                ["Vendor", extraction.vendor_name],
                ["Invoice #", extraction.invoice_number],
                ["Date", extraction.date],
                ["Subtotal", extraction.subtotal != null ? `${extraction.currency ?? ""} ${extraction.subtotal}` : null],
                ["Tax", extraction.tax != null ? `${extraction.currency ?? ""} ${extraction.tax}` : null],
                ["Total", extraction.total_amount != null ? `${extraction.currency ?? ""} ${extraction.total_amount}` : null],
                ["Language", extraction.language_detected],
              ].map(([label, val]) => (
                val != null && (
                  <div key={label as string} className="value-box">
                    <div className="value-box__label">{label as string}</div>
                    <div className="value-box__val">{val as string}</div>
                  </div>
                )
              ))}
            </div>
            {extraction.raw_text_snippet && (
              <div className="finding-card__evidence" style={{ marginTop: "14px" }}>
                &ldquo;{extraction.raw_text_snippet}&rdquo;
              </div>
            )}
            {extraction.line_items?.length > 0 && (
              <div style={{ marginTop: "16px", overflowX: "auto" }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Unit Price</th>
                      <th>Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {extraction.line_items.map((li, i) => (
                      <tr key={i}>
                        <td>{li.description}</td>
                        <td>{li.quantity ?? "—"}</td>
                        <td>{li.unit_price ?? "—"}</td>
                        <td>{li.line_total ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Step 3: Findings ────────────────────────────────────────── */}
        {(step === "resolve" || step === "export") && (
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">⚡</div>
                Findings
                {findings.length > 0 && (
                  <span style={{ color: "var(--text-muted)", fontWeight: 400, fontSize: "13px" }}>
                    ({openCount} open, {findings.length - openCount} resolved)
                  </span>
                )}
              </div>
              <span className={`card__badge ${findings.length === 0 ? "badge--done" : openCount === 0 ? "badge--done" : "badge--warn"}`}>
                {findings.length === 0 ? "All clear" : `${openCount} open`}
              </span>
            </div>
            <FindingsPanel findings={findings} onResolve={handleResolve} />
          </div>
        )}

        {/* ── Summary ─────────────────────────────────────────────────── */}
        {step === "resolve" && findings.length > 0 && (
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">💬</div>
                Gemma Summary
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  className="table-select"
                  value={summaryLang}
                  onChange={(e) => setSummaryLang(e.target.value as "en" | "ur")}
                  id="select-lang"
                >
                  <option value="en">English</option>
                  <option value="ur">اردو</option>
                </select>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={handleSummarize}
                  disabled={isSummarizing}
                  id="btn-summarize"
                >
                  {isSummarizing ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Generating…</> : "Generate Summary"}
                </button>
              </div>
            </div>
            {summary ? (
              <div className={`summary-box ${summaryLang === "ur" ? "ur" : ""}`}>
                {summary}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Ask Gemma to write a plain-language summary of the findings.
              </p>
            )}
          </div>
        )}

        {/* ── Step 4: Export Gate ──────────────────────────────────────── */}
        {step === "resolve" && (
          <ExportGate
            findings={findings}
            allResolved={allDone}
            onExport={handleExport}
          />
        )}

      </main>
    </div>
  );
}
