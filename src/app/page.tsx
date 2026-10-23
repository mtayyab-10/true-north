"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import type { Finding, TypedEntry, ExtractionResult, BusinessContext, FindingStatus, ReleaseRecord } from "@/lib/types";
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
  const [releasedRecord, setReleasedRecord] = useState<ReleaseRecord | null>(null);

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
              // Scroll to workspace
              document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
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
      setTimeout(() => {
        document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch {
      setStep("compare");
      setTimeout(() => {
        document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
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

  // 1-Click Adopt All Document Values
  const handleAdoptAllDocValues = () => {
    setFindings((prev) =>
      prev.map((f) => {
        if (f.document_value && f.status === "open") {
          const updated = resolveFinding(
            f,
            "resolved_accepted",
            f.document_value,
            "Adopted verified document value"
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
      {/* ── Top Marketing Header ────────────────────────────────────────── */}
      <header className="pk-header">
        <div className="pk-container" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <Link href="/" className="pk-logo">
              <span className="pk-logo-mark">T</span>
              <span>TrueNorth</span>
            </Link>
          </div>

          <nav className="pk-nav">
            <a href="#problem" className="pk-nav-link">The problem</a>
            <a href="#workflow" className="pk-nav-link">How it works</a>
            <a href="#trust" className="pk-nav-link">Trust</a>
            <Link href="/demo-form" className="pk-nav-link">Controlled Form ↗</Link>
            <button
              className="pk-button-primary"
              onClick={loadDemo}
              id="nav-begin-demo"
            >
              Begin demo
            </button>
          </nav>
        </div>
      </header>

      {/* ── Main Marketing & Workspace Shell ───────────────────────────── */}
      <main className="pk-container">
        {/* ── HERO SECTION (Matching reference image) ──────────────────── */}
        <section className="hero-layout">
          <div>
            <div className="hero-eyebrow">A quality gate before the database</div>
            <h1 className="hero-headline">
              Catch the wrong number before it is saved.
            </h1>
            <p className="hero-lead">
              A pre-submission QA layer for company financials. Check the context, show the evidence, and give analysts a clear decision before data is accepted.
            </p>
            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <button
                className="pk-button-primary"
                onClick={loadDemo}
                id="btn-hero-demo"
                style={{ fontSize: "15px", padding: "12px 24px" }}
              >
                Begin Live Demo →
              </button>
              <a
                href="#workspace"
                className="pk-button-secondary"
                style={{ fontSize: "15px", padding: "12px 24px" }}
              >
                Open Workspace ↓
              </a>
              <Link
                href="/demo-form"
                className="pk-button-secondary"
                style={{ fontSize: "15px", padding: "12px 24px" }}
              >
                Controlled Form ↗
              </Link>
            </div>

            <div className="hero-note">
              <div className="hero-note-line"></div>
              <p>
                Ordinary code for certainty. Statistics for signals. Gemma 4 for contextual arbitration. Human review for accountability.
              </p>
            </div>
          </div>

          {/* Right Visual Spine (From entry to acceptance) */}
          <div className="spine-box">
            <div className="spine-label">
              <span>—</span> From entry to acceptance
            </div>

            <div className="spine-flow">
              {/* Node 1 */}
              <div className="spine-card animate-in">
                <span className="spine-badge">ENT-00001</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, fontSize: "14px", color: "var(--pk-navy)", marginBottom: "4px" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                    <polyline points="14 2 14 8 20 8"></polyline>
                    <line x1="16" y1="13" x2="8" y2="13"></line>
                    <line x1="16" y1="17" x2="8" y2="17"></line>
                  </svg>
                  <span>Original file preserved</span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "0 0 10px" }}>
                  Inspect columns and source values before making any changes.
                </p>
                <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "4px", padding: "6px 10px", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
                  <div style={{ color: "var(--text-muted)" }}>Al-Kareem General Store</div>
                  <strong style={{ color: "var(--pk-navy)" }}>total_amount: 16800.00 PKR</strong>
                </div>
              </div>

              <div className="spine-connector"></div>

              {/* Node 2 */}
              <div className="spine-card animate-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--pk-navy)" }}>2. Deterministic Check</strong>
                  <span style={{ fontSize: "11px", color: "var(--sev-ok)", fontWeight: 600 }}>✓ Math Validated</span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Subtotal + Tax matches total amount. Decimal places and date formats verified.
                </p>
              </div>

              <div className="spine-connector"></div>

              {/* Node 3 */}
              <div className="spine-card animate-in">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--pk-navy)" }}>3. Gemma 4 Contextual Check</strong>
                  <span style={{ fontSize: "11px", color: "var(--sev-med)", fontWeight: 600 }}>Signal Analyzed</span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Unit price benchmarked against wholesale grocery distribution bounds.
                </p>
              </div>

              <div className="spine-connector"></div>

              {/* Node 4 */}
              <div className="spine-card animate-in" style={{ borderLeft: "4px solid var(--sev-ok)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <strong style={{ fontSize: "13px", color: "var(--pk-navy)" }}>4. Quality Gate Release</strong>
                  <span style={{ fontSize: "11px", color: "var(--sev-ok)", fontWeight: 700 }}>SHA-256 Sealed</span>
                </div>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  Release bundle signed with cryptographic audit trail before database write.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION: THE PROBLEM (#problem) ─────────────────────────── */}
        <section id="problem" className="marketing-section">
          <div className="section-head">
            <div className="hero-eyebrow">The Problem</div>
            <h2 className="section-title">Clerical errors corrupt databases before anyone notices.</h2>
            <p className="section-sub">
              Manual entry, messy invoice scans, and rushed submissions quietly inject wrong figures into downstream ERPs, leading to costly dispute cycles and audit penalties.
            </p>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <div className="stat-number">88%</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--pk-navy)", marginBottom: "6px" }}>Of Spreadsheets Contain Errors</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Clerical digit transposition (e.g., 0824 vs 0842) and misplaced decimal points silently corrupt balance sheets.
              </p>
            </div>

            <div className="stat-card">
              <div className="stat-number">4.8 hrs</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--pk-navy)", marginBottom: "6px" }}>Lost Weekly Per Reviewer</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Accountants spend hours cross-referencing paper receipts against database rows after discrepancies are discovered.
              </p>
            </div>

            <div className="stat-card">
              <div className="stat-number">100%</div>
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--pk-navy)", marginBottom: "6px" }}>Preventable at Ingestion</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                An active pre-submission gate stops invalid data from entering the database, enforcing fixes at the source.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION: HOW IT WORKS (#workflow) ───────────────────────── */}
        <section id="workflow" className="marketing-section">
          <div className="section-head">
            <div className="hero-eyebrow">How It Works</div>
            <h2 className="section-title">The 4-Stage Pre-Submission Workflow</h2>
            <p className="section-sub">
              A disciplined division of responsibilities: deterministic rules for math, Gemma 4 for contextual arbitration, and accountable humans for release authorization.
            </p>
          </div>

          <div className="workflow-grid">
            <div className="workflow-card">
              <div>
                <div className="workflow-card__num">PHASE 01</div>
                <h3 className="workflow-card__title">Ingestion &amp; Visual Extraction</h3>
                <p className="workflow-card__desc">
                  Capture draft entries directly from forms via the browser extension, or upload visual invoices. Gemma 4 reads multimodal text with OCR resilience.
                </p>
              </div>
              <div className="workflow-roles">
                <div><strong>Code:</strong> DOM input normalization</div>
                <div><strong>Gemma 4:</strong> Visual multimodal field extraction</div>
                <div><strong>Human:</strong> Provides the source document</div>
              </div>
            </div>

            <div className="workflow-card">
              <div>
                <div className="workflow-card__num">PHASE 02</div>
                <h3 className="workflow-card__title">Deterministic &amp; Statistical Engine</h3>
                <p className="workflow-card__desc">
                  Zero-hallucination arithmetic rules run simultaneously with distribution statistics (e.g. commodity unit prices, date bounds, required fields).
                </p>
              </div>
              <div className="workflow-roles">
                <div><strong>Code:</strong> Exact calculation (subtotal + tax = total)</div>
                <div><strong>Statistics:</strong> Distribution benchmark signals</div>
                <div><strong>Human:</strong> Unburdened from routine manual math</div>
              </div>
            </div>

            <div className="workflow-card">
              <div>
                <div className="workflow-card__num">PHASE 03</div>
                <h3 className="workflow-card__title">Evidence-Backed Discrepancy Review</h3>
                <p className="workflow-card__desc">
                  Discrepancies are highlighted with concrete evidence. Reviewers can adopt verified scan values in 1 click, correct typos, or record justified exceptions.
                </p>
              </div>
              <div className="workflow-roles">
                <div><strong>Gemma 4:</strong> Plain-language synthesis &amp; reasoning</div>
                <div><strong>Human:</strong> Explicit approval or documented override</div>
                <div><strong>Code:</strong> Full audit reason logging</div>
              </div>
            </div>

            <div className="workflow-card">
              <div>
                <div className="workflow-card__num">PHASE 04</div>
                <h3 className="workflow-card__title">Quality Gate Release &amp; Seal</h3>
                <p className="workflow-card__desc">
                  Strict release gate blocks downstream ingestion until blocking errors are resolved. Once approved, TrueNorth issues a tamper-evident SHA-256 seal.
                </p>
              </div>
              <div className="workflow-roles">
                <div><strong>Code:</strong> Cryptographic SHA-256 signature</div>
                <div><strong>Human:</strong> Authorizes final release to ERP</div>
                <div><strong>System:</strong> Exports verified CSV and JSON bundle</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── SECTION: TRUST & SAFETY (#trust) ────────────────────────── */}
        <section id="trust" className="marketing-section">
          <div className="section-head">
            <div className="hero-eyebrow">Trust &amp; Architecture</div>
            <h2 className="section-title">Built for Enterprise Auditability</h2>
            <p className="section-sub">
              AI should assist verification, not act as an unverified black box. TrueNorth is engineered with strict deterministic guarantees.
            </p>
          </div>

          <div className="stat-grid">
            <div className="stat-card">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--pk-navy)", marginBottom: "8px" }}>Deterministic Math Guarantees</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Numerical calculations are executed via exact code rules, never inferred probabilistically by an LLM.
              </p>
            </div>

            <div className="stat-card">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--pk-navy)", marginBottom: "8px" }}>Cryptographic Release Seals</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Every released batch receives a SHA-256 checksum binding the exact values, reviewer notes, and timestamp.
              </p>
            </div>

            <div className="stat-card">
              <h3 style={{ fontSize: "16px", fontWeight: 700, color: "var(--pk-navy)", marginBottom: "8px" }}>Hybrid Extension &amp; Web App</h3>
              <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, lineHeight: 1.5 }}>
                Inspect live browser forms in-page via the extension, or upload invoice scans directly to the workspace.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION: LIVE WORKSPACE (#workspace) ─────────────────────── */}
        <section id="workspace" style={{ padding: "48px 0 80px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
            <div>
              <div className="hero-eyebrow" style={{ margin: 0 }}>Interactive Workspace</div>
              <h2 style={{ fontFamily: "var(--font-display)", fontSize: "28px", fontWeight: 700, color: "var(--pk-navy)", margin: "4px 0 0" }}>
                TrueNorth Verification Pipeline
              </h2>
            </div>

            {/* Stepper Header Navigation */}
            <div className="steps" role="navigation" aria-label="Verification Steps">
              {steps.map((s, i) => {
                const si = stepIndex(step);
                const isDone = i < si || (s.id === "export" && releasedRecord !== null);
                const isActive = s.id === step;
                const cls = isDone ? "done" : isActive ? "active" : "";
                return (
                  <div key={s.id} style={{ display: "flex", alignItems: "center" }}>
                    <button
                      type="button"
                      className={`step ${cls}`}
                      onClick={() => setStep(s.id)}
                      title={`Navigate to ${s.label}`}
                      style={{ background: "transparent", border: "none", cursor: "pointer", font: "inherit", padding: "4px 8px" }}
                    >
                      <div className="step__dot">
                        {isDone && !isActive ? (
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        ) : (
                          i + 1
                        )}
                      </div>
                      <span className="step__label">{s.label}</span>
                    </button>
                    {i < steps.length - 1 && <div className="step__line" />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Business Context Bar */}
          <div className="context-card animate-in" style={{ marginBottom: "20px" }}>
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
                <div style={{ color: "var(--pk-navy)", display: "flex" }}>
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </div>
                <div>
                  <strong style={{ fontSize: "13px", color: "var(--text-primary)" }}>
                    Domain Parameters:
                  </strong>
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--text-muted)",
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
              <div className="context-grid animate-in" style={{ marginTop: "16px" }}>
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
                    placeholder="e.g. Bulk discounts pre-authorized"
                  />
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="gate-alert gate-alert--blocked animate-in" style={{ marginBottom: "16px" }}>
              <span>Error:</span> {error}
            </div>
          )}

          {/* ── View 1 & 2: Data Input & Entry ──────────────────────────── */}
          {(step === "upload" || step === "compare") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px" }}>
              {/* Document Upload Zone */}
              <div className="card animate-in">
                <div className="card__header">
                  <div className="card__title">
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
                      Extract Document with Gemma 4
                    </button>
                  </div>
                )}
                {isExtracting && (
                  <div style={{ textAlign: "center", padding: "16px", color: "var(--pk-navy)" }}>
                    Gemma 4 is reading the document...
                  </div>
                )}
                {!imageBase64 && !usedDemo && (
                  <div style={{ marginTop: "16px", textAlign: "center" }}>
                    <button
                      className="btn btn--secondary btn--sm"
                      onClick={loadDemo}
                      id="btn-demo"
                    >
                      Load Demo Sample
                    </button>
                  </div>
                )}
                {usedDemo && (
                  <div style={{ marginTop: "12px", fontSize: "12px", color: "var(--text-secondary)", background: "var(--bg-elevated)", padding: "8px 12px", borderRadius: "var(--r-sm)", border: "1px solid var(--border)" }}>
                    Demo invoice sample loaded with planted numerical discrepancies.
                  </div>
                )}
              </div>

              {/* Manual Entry Table */}
              <div className="card animate-in">
                <div className="card__header">
                  <div className="card__title">
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
                    {isVerifying ? "Verifying Data Quality…" : "Run Verification Pipeline"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Visual Extraction Preview (if extracted) */}
          {extraction && (step === "upload" || step === "compare") && (
            <div className="card animate-in" style={{ marginTop: "24px" }}>
              <div className="card__header">
                <div className="card__title">
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

          {/* ── View 3: Review Findings & Human Resolution ──────────────── */}
          {step === "resolve" && (
            <div className="animate-in">
              <div className="card" style={{ marginTop: "20px" }}>
                <div className="card__header">
                  <div className="card__title">
                    Step 3: Verification Findings &amp; Discrepancy Review
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
                        Adopt All Document Values
                      </button>
                    )}
                    {/* Step Transfer Button to Quality Gate */}
                    <button
                      className="btn btn--primary btn--sm"
                      onClick={() => {
                        setStep("export");
                        document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      id="btn-transfer-step4"
                    >
                      Proceed to Quality Gate (Step 4) →
                    </button>
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

              {/* Gemma 4 Plain Language Summary */}
              {findings.length > 0 && (
                <div className="card animate-in" style={{ marginTop: "20px" }}>
                  <div className="card__header">
                    <div className="card__title">
                      Gemma 4 Contextual Summary
                    </div>
                    <button
                      className="btn btn--ghost btn--sm"
                      onClick={handleSummarize}
                      disabled={isSummarizing}
                      id="btn-summarize"
                    >
                      {isSummarizing ? "Generating…" : "Refresh Summary"}
                    </button>
                  </div>
                  {summary ? (
                    <div className="summary-box">
                      {summary}
                    </div>
                  ) : (
                    <p style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                      Generate an AI plain-language summary of verification results.
                    </p>
                  )}
                </div>
              )}

              {/* Advancement Callout Card */}
              <div
                className="card animate-in"
                style={{
                  marginTop: "20px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  background: openCount === 0 ? "var(--bg-elevated)" : "var(--bg-elevated)",
                  borderColor: openCount === 0 ? "var(--sev-ok)" : "var(--border)",
                }}
              >
                <div>
                  <strong style={{ fontSize: "14px", color: "var(--text-primary)" }}>
                    {openCount === 0
                      ? "All findings resolved — Ready for Quality Gate release"
                      : `${openCount} issue(s) still open. You can resolve them above or inspect the Quality Gate release criteria.`}
                  </strong>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: "2px 0 0" }}>
                    Advance to Step 4 to issue the tamper-evident cryptographic seal and export your audit bundle.
                  </p>
                </div>
                <button
                  className="btn btn--primary btn--lg"
                  onClick={() => {
                    setStep("export");
                    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  id="btn-bottom-step4"
                >
                  Proceed to Step 4: Quality Gate Release →
                </button>
              </div>
            </div>
          )}

          {/* ── View 4: Dedicated Quality Gate Release View ───────────────── */}
          {step === "export" && (
            <div className="animate-in" style={{ marginTop: "20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>
                    Step 4: Quality Gate Release &amp; Tamper-Evident Certification
                  </h2>
                  <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
                    Enforce strict release gates before transmitting records to downstream ERP or general ledger systems.
                  </p>
                </div>
                <button
                  className="btn btn--secondary btn--sm"
                  onClick={() => {
                    setStep("resolve");
                    document.getElementById("workspace")?.scrollIntoView({ behavior: "smooth" });
                  }}
                >
                  ← Back to Review Findings (Step 3)
                </button>
              </div>

              {/* Quality Gate Component */}
              <ExportGate
                findings={findings}
                typedEntries={typedEntries}
                context={businessContext}
                sessionId={sessionId}
                onReleased={(record) => {
                  setReleasedRecord(record);
                  setStep("export");
                }}
              />

              {/* Verified Entries Table Overview */}
              <div className="card animate-in" style={{ marginTop: "24px" }}>
                <div className="card__header">
                  <div className="card__title">
                    Final Audit Snapshot — Field Records
                  </div>
                  <span className="card__badge badge--done">
                    {typedEntries.length} Fields Verified
                  </span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border)", textAlign: "left", color: "var(--text-muted)", fontSize: "11px", textTransform: "uppercase" }}>
                        <th style={{ padding: "8px 12px" }}>Field</th>
                        <th style={{ padding: "8px 12px" }}>Raw Input</th>
                        <th style={{ padding: "8px 12px" }}>Final Verified Value</th>
                        <th style={{ padding: "8px 12px" }}>Audit Status</th>
                        <th style={{ padding: "8px 12px" }}>Resolution Reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typedEntries.map((e) => {
                        const f = findings.find((fi) => fi.field === e.field);
                        return (
                          <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--text-primary)" }}>
                              {e.field}
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                              {e.typed_value || "—"}
                            </td>
                            <td style={{ padding: "10px 12px", fontWeight: 600, color: "var(--sev-ok)", fontFamily: "monospace" }}>
                              {f?.resolved_value || e.typed_value || "—"}
                            </td>
                            <td style={{ padding: "10px 12px" }}>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  padding: "2px 8px",
                                  borderRadius: "var(--r-full)",
                                  background: f && f.status === "open" ? "rgba(194,59,60,0.12)" : "rgba(15,123,108,0.12)",
                                  color: f && f.status === "open" ? "var(--sev-high)" : "var(--sev-ok)",
                                }}
                              >
                                {f ? f.status.replace(/_/g, " ") : "verified clean"}
                              </span>
                            </td>
                            <td style={{ padding: "10px 12px", color: "var(--text-secondary)", fontSize: "12px" }}>
                              {f?.resolution_reason || "Conforms to verification rules"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── FOOTER ─────────────────────────────────────────────────── */}
        <footer style={{ borderTop: "1px solid var(--border)", padding: "36px 0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <Link href="/" className="pk-logo" style={{ fontSize: "18px" }}>
              <span className="pk-logo-mark" style={{ width: "24px", height: "24px", fontSize: "14px" }}>T</span>
              <span>TrueNorth</span>
            </Link>
            <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
              Catch the wrong number before it is saved.
            </p>
          </div>
          <div style={{ display: "flex", gap: "20px", fontSize: "13px" }}>
            <a href="#problem" className="pk-nav-link">The problem</a>
            <a href="#workflow" className="pk-nav-link">How it works</a>
            <a href="#trust" className="pk-nav-link">Trust</a>
            <Link href="/demo-form" className="pk-nav-link">Controlled Form ↗</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
