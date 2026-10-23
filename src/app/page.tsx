"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import type { Finding, TypedEntry, ExtractionResult, BusinessContext, FindingStatus } from "@/lib/types";
import { resolveFinding } from "@/lib/rules-engine";
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usedDemo, setUsedDemo] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);

  // Business Context State
  const [businessContext, setBusinessContext] = useState<BusinessContext>({
    business_type: "Wholesale & Retail Grocery",
    currency: "PKR",
    reporting_period: "October 2026",
    allowed_variance_pct: 0,
    notes: "",
  });
  const [showContextDrawer, setShowContextDrawer] = useState(false);

  // Load Session from URL if present (from Browser Extension)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const sId = urlParams.get("session");
      if (sId) {
        setSessionId(sId);
        fetch(`/api/session?id=${encodeURIComponent(sId)}`)
          .then((r) => r.json())
          .then((data) => {
            if (data.session) {
              setTypedEntries(data.session.entries || DEFAULT_ENTRIES);
              setExtraction(data.session.documentExtraction || null);
              setFindings(data.session.findings || []);
              if (data.session.context) setBusinessContext(data.session.context);
              setStep("resolve");
            }
          })
          .catch((err) => console.warn("Could not load session:", err));
      }
    }
  }, []);

  // Image upload handler
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

  // Step 1: Extract with Gemma
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

  // Step 2: Unified Verification Pipeline
  const handleVerify = async () => {
    setIsVerifying(true);
    setError(null);

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: typedEntries,
          documentExtraction: extraction,
          context: businessContext,
          sessionId,
          source: "web",
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || "Verification failed");
      }

      setFindings(json.findings || []);
      setSessionId(json.sessionId);
      if (json.summary) setSummary(json.summary);
      setStep("resolve");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification error";
      setError(msg);
    } finally {
      setIsVerifying(false);
    }
  };

  // Load demo mode
  const loadDemo = async () => {
    setTypedEntries(DEMO_TYPED_ENTRIES);
    setExtraction(DEMO_EXTRACTION);
    setImagePreview(null);
    setUsedDemo(true);

    setIsVerifying(true);
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries: DEMO_TYPED_ENTRIES,
          documentExtraction: DEMO_EXTRACTION,
          context: businessContext,
          source: "web",
        }),
      });
      const data = await res.json();
      setFindings(data.findings || []);
      if (data.summary) setSummary(data.summary);
      setStep("resolve");
    } catch {
      setStep("compare");
    } finally {
      setIsVerifying(false);
    }
  };

  // Resolve a single finding
  const handleResolve = (
    findingId: string,
    resolution: FindingStatus,
    editedValue?: string,
    reason?: string
  ) => {
    setFindings((prev) =>
      prev.map((f) => {
        if (f.finding_id !== findingId) return f;
        const updated = resolveFinding(f, resolution, editedValue, reason);
        // Also update typedEntries value if corrected/accepted
        if (updated.resolved_value) {
          setTypedEntries((tPrev) =>
            tPrev.map((te) =>
              te.field === f.field ? { ...te, typed_value: updated.resolved_value! } : te
            )
          );
        }
        return updated;
      })
    );
  };

  // 1-Click Adopt All Verified Document Values
  const handleAdoptAllDocValues = () => {
    setFindings((prev) =>
      prev.map((f) => {
        if (f.document_value && f.status === "open") {
          const updated = resolveFinding(
            f,
            "resolved_accepted",
            f.document_value,
            "Batch accepted verified document value"
          );
          setTypedEntries((tPrev) =>
            tPrev.map((te) =>
              te.field === f.field ? { ...te, typed_value: f.document_value! } : te
            )
          );
          return updated;
        }
        return f;
      })
    );
  };

  // Plain-Language Summary
  const handleSummarize = async () => {
    setIsSummarizing(true);
    setSummary(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ findings, language: "en" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Summary failed");
      setSummary(json.summary);
    } catch (err: unknown) {
      setSummary(
        "Could not generate summary: " +
          (err instanceof Error ? err.message : "Unknown")
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  const steps = [
    { id: "upload", label: "1. Data Input" },
    { id: "compare", label: "2. Verification" },
    { id: "resolve", label: "3. Review Findings" },
    { id: "export", label: "4. Quality Gate Release" },
  ] as const;

  const stepIndex = (s: Step) => steps.findIndex((st) => st.id === s);
  const openCount = findings.filter((f) => f.status === "open").length;
  const hasDocMismatch = findings.some((f) => f.document_value && f.status === "open");

  return (
    <div className="page-shell">
      {/* ── Top Bar ─────────────────────────────────────────────────────── */}
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo glow-pulse">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <span className="topbar__title">Tasdeeq</span>
            <span className="topbar__sub">Data Quality &amp; Pre-Submission Verification Gate</span>
          </div>
        </div>

        <nav className="nav-tab-bar">
          <span className="nav-tab-item nav-tab-item--active">
            Main Workspace
          </span>
          <Link href="/demo-form" className="nav-tab-item">
            Controlled Demo Form ↗
          </Link>
        </nav>

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
          <span className="topbar__badge">Gemma 4 · 26B Hybrid</span>
        </div>
      </header>

      {/* ── Main Container ──────────────────────────────────────────────── */}
      <main className="main-content">
        {/* Header Tagline */}
        <div style={{ textAlign: "center", paddingBottom: "12px" }}>
          <h1
            style={{
              fontSize: "26px",
              fontWeight: 700,
              marginBottom: "6px",
              letterSpacing: "-0.5px",
            }}
          >
            Context-Aware Data Quality &amp;{" "}
            <span style={{ color: "var(--accent)" }}>Pre-Submission Gate</span>
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "14px",
              maxWidth: "680px",
              margin: "0 auto",
            }}
          >
            Deterministic code for certainty. Statistics for signals. Gemma 4 for context.
            Human review for accountability.
          </p>
        </div>

        {/* Business Context Bar */}
        <div className="context-card animate-in">
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              cursor: "pointer",
            }}
            onClick={() => setShowContextDrawer(!showContextDrawer)}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span style={{ fontSize: "16px" }}>⚙️</span>
              <div>
                <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                  Business Context &amp; Parameters:
                </strong>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginLeft: "8px",
                  }}
                >
                  {businessContext.business_type} · {businessContext.currency} ·{" "}
                  {businessContext.reporting_period}
                </span>
              </div>
            </div>
            <button
              className="btn btn--ghost btn--sm"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextDrawer(!showContextDrawer);
              }}
            >
              {showContextDrawer ? "Hide Parameters" : "Edit Parameters"}
            </button>
          </div>

          {showContextDrawer && (
            <div className="context-grid animate-in">
              <div className="context-field">
                <label>Business Classification</label>
                <select
                  className="table-input"
                  value={businessContext.business_type}
                  onChange={(e) =>
                    setBusinessContext({ ...businessContext, business_type: e.target.value })
                  }
                >
                  <option value="Wholesale & Retail Grocery">Grocery &amp; Retail</option>
                  <option value="Pharmacy & Healthcare Supplies">Pharmacy &amp; Healthcare</option>
                  <option value="Hardware & Construction Materials">Hardware &amp; Construction</option>
                  <option value="General Commercial Trade">General Commercial Trade</option>
                </select>
              </div>

              <div className="context-field">
                <label>Reporting Currency</label>
                <select
                  className="table-input"
                  value={businessContext.currency}
                  onChange={(e) =>
                    setBusinessContext({ ...businessContext, currency: e.target.value })
                  }
                >
                  <option value="PKR">PKR (Pakistani Rupee)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                </select>
              </div>

              <div className="context-field">
                <label>Reporting Period</label>
                <input
                  type="text"
                  className="table-input"
                  value={businessContext.reporting_period}
                  onChange={(e) =>
                    setBusinessContext({
                      ...businessContext,
                      reporting_period: e.target.value,
                    })
                  }
                  placeholder="e.g. October 2026"
                />
              </div>

              <div className="context-field">
                <label>Contextual Notes</label>
                <input
                  type="text"
                  className="table-input"
                  value={businessContext.notes || ""}
                  onChange={(e) =>
                    setBusinessContext({ ...businessContext, notes: e.target.value })
                  }
                  placeholder="e.g. Surcharges pre-approved"
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="alert alert--error animate-in" style={{ marginBottom: "16px" }}>
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── Two-Column Workflow: Input & Data ───────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
          {/* Document Upload Zone */}
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">📄</div>
                Document Photo / Invoice Scan
              </div>
              <span className="card__badge badge--step">Visual Source</span>
            </div>
            <Uploader onImageSelect={handleImageSelect} preview={imagePreview} />
            {imageBase64 && !isExtracting && step === "upload" && (
              <div style={{ marginTop: "16px" }}>
                <button
                  className="btn btn--primary btn--lg"
                  style={{ width: "100%" }}
                  onClick={handleExtract}
                  id="btn-extract"
                >
                  <span>✨</span> Extract Document with Gemma 4
                </button>
              </div>
            )}
            {isExtracting && (
              <div className="loading-overlay">
                <div className="spinner" />
                <span>Gemma 4 is reading the document&hellip;</span>
              </div>
            )}
            {!imageBase64 && !usedDemo && (
              <div style={{ marginTop: "16px", textAlign: "center" }}>
                <button
                  className="btn btn--ghost btn--sm"
                  onClick={loadDemo}
                  id="btn-demo"
                >
                  ⚡ Load Demo Invoice Sample
                </button>
              </div>
            )}
            {usedDemo && (
              <div className="alert alert--info animate-in" style={{ marginTop: "12px" }}>
                <span>ℹ</span>
                <span>Demo mode loaded: Sample invoice with discrepancies ready for verification.</span>
              </div>
            )}
          </div>

          {/* Manual Entry Table */}
          <div className="card animate-in">
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">⌨️</div>
                Manual / Captured Data
              </div>
              <span className="card__badge badge--step">Data Fields</span>
            </div>
            <EntryTable entries={typedEntries} onChange={setTypedEntries} />
            <div style={{ marginTop: "16px" }}>
              <button
                className="btn btn--primary btn--lg"
                style={{ width: "100%" }}
                onClick={handleVerify}
                disabled={isVerifying}
                id="btn-run-verification"
              >
                {isVerifying ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    Verifying (Rules + Benchmarks + Gemma 4)…
                  </>
                ) : (
                  "🔍 Run Verification Pipeline"
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Visual Extraction Preview */}
        {extraction && (
          <div className="card animate-in" style={{ marginTop: "24px" }}>
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">🔎</div>
                Visual Extraction (Gemma 4 Multimodal)
              </div>
              <span className="card__badge badge--done">Extracted</span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                gap: "12px",
              }}
            >
              {[
                ["Vendor", extraction.vendor_name],
                ["Invoice #", extraction.invoice_number],
                ["Date", extraction.date],
                [
                  "Subtotal",
                  extraction.subtotal != null
                    ? `${extraction.currency ?? ""} ${extraction.subtotal}`
                    : null,
                ],
                [
                  "Tax",
                  extraction.tax != null
                    ? `${extraction.currency ?? ""} ${extraction.tax}`
                    : null,
                ],
                [
                  "Total Amount",
                  extraction.total_amount != null
                    ? `${extraction.currency ?? ""} ${extraction.total_amount}`
                    : null,
                ],
              ].map(
                ([label, val]) =>
                  val != null && (
                    <div key={label as string} className="value-box">
                      <div className="value-box__label">{label as string}</div>
                      <div className="value-box__val">{val as string}</div>
                    </div>
                  )
              )}
            </div>
          </div>
        )}

        {/* ── Step 3: Verification Findings & Review ──────────────────── */}
        {step === "resolve" && (
          <div className="card animate-in" style={{ marginTop: "24px" }}>
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">⚡</div>
                Verification Findings &amp; Review
                {findings.length > 0 && (
                  <span
                    style={{
                      color: "var(--text-muted)",
                      fontWeight: 400,
                      fontSize: "13px",
                      marginLeft: "6px",
                    }}
                  >
                    ({openCount} open, {findings.length - openCount} resolved)
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {hasDocMismatch && (
                  <button
                    className="btn btn--success btn--sm"
                    onClick={handleAdoptAllDocValues}
                    id="btn-adopt-all"
                  >
                    ⚡ 1-Click Adopt All Document Values
                  </button>
                )}
                <span
                  className={`card__badge ${
                    findings.length === 0
                      ? "badge--done"
                      : openCount === 0
                      ? "badge--done"
                      : "badge--warn"
                  }`}
                >
                  {findings.length === 0 ? "All clear" : `${openCount} open`}
                </span>
              </div>
            </div>
            <FindingsPanel findings={findings} onResolve={handleResolve} />
          </div>
        )}

        {/* ── Summary & Explanation ───────────────────────────────────── */}
        {step === "resolve" && findings.length > 0 && (
          <div className="card animate-in" style={{ marginTop: "24px" }}>
            <div className="card__header">
              <div className="card__title">
                <div className="card__icon">💬</div>
                Gemma 4 Verification Summary
              </div>
              <button
                className="btn btn--ghost btn--sm"
                onClick={handleSummarize}
                disabled={isSummarizing}
                id="btn-summarize"
              >
                {isSummarizing ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />{" "}
                    Generating…
                  </>
                ) : (
                  "Refresh Plain-Language Summary"
                )}
              </button>
            </div>
            {summary ? (
              <div className="summary-box">
                {summary}
              </div>
            ) : (
              <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                Click above to generate a plain-language summary of the verification findings.
              </p>
            )}
          </div>
        )}

        {/* ── Step 4: Quality Gate & Release ──────────────────────────── */}
        {step === "resolve" && (
          <ExportGate
            findings={findings}
            typedEntries={typedEntries}
            context={businessContext}
            sessionId={sessionId}
          />
        )}
      </main>
    </div>
  );
}
