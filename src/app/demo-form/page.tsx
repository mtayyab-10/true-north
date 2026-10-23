"use client";
import { useState } from "react";
import Link from "next/link";
import { runUnifiedVerification, evaluateQualityGate } from "@/lib/verification-engine";
import type { TypedEntry, Finding, QualityGateState } from "@/lib/types";

export default function ControlledDemoFormPage() {
  const [formData, setFormData] = useState({
    vendor_name: "Al-Kareem General Store",
    invoice_number: "INV-2026-0824", // Intentional error: transposed digit (824 vs 842)
    date: "2026-10-15",
    currency: "PKR",
    item_description: "Basmati Rice (25 kg sack)",
    quantity: "5",
    unit_price: "3200",
    subtotal: "16000",
    tax: "800",
    total_amount: "54000", // Intentional error: 54000 typed instead of 16800 or 50400
  });

  const [businessType, setBusinessType] = useState("Wholesale & Retail Grocery");
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    gateState: QualityGateState;
    findings: Finding[];
    summary: string;
  } | null>(null);

  const [guardModalOpen, setGuardModalOpen] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const handleChange = (field: string, val: string) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
    // Reset submission state on edit
    setSubmissionSuccess(false);
  };

  const loadFlawedSample = () => {
    setFormData({
      vendor_name: "Al-Kareem General Store",
      invoice_number: "INV-2026-0824", // Transposed
      date: "2026-10-15",
      currency: "PKR",
      item_description: "Basmati Rice (25 kg sack)",
      quantity: "5",
      unit_price: "3200",
      subtotal: "16000",
      tax: "800",
      total_amount: "54000", // Gross math mismatch
    });
    setVerificationResult(null);
    setSubmissionSuccess(false);
  };

  const loadCleanSample = () => {
    setFormData({
      vendor_name: "Al-Kareem General Store",
      invoice_number: "INV-2026-0842",
      date: "2026-10-15",
      currency: "PKR",
      item_description: "Basmati Rice (25 kg sack)",
      quantity: "5",
      unit_price: "3200",
      subtotal: "16000",
      tax: "800",
      total_amount: "16800",
    });
    setVerificationResult(null);
    setSubmissionSuccess(false);
  };

  const loadOutlierSample = () => {
    setFormData({
      vendor_name: "Habib Sugar Mills",
      invoice_number: "HSM-9912",
      date: "2026-10-20",
      currency: "PKR",
      item_description: "Refined White Sugar (50 kg)",
      quantity: "2",
      unit_price: "35000", // Outlier: Standard benchmark is ~6,000 PKR
      subtotal: "70000",
      tax: "3500",
      total_amount: "73500",
    });
    setVerificationResult(null);
    setSubmissionSuccess(false);
  };

  const runVerification = async () => {
    setIsVerifying(true);
    const entries: TypedEntry[] = Object.entries(formData).map(([k, v], i) => ({
      id: `field_${i}`,
      field: k,
      typed_value: v,
    }));

    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entries,
          context: {
            business_type: businessType,
            currency: formData.currency,
            reporting_period: "October 2026",
            allowed_variance_pct: 0,
          },
          source: "demo_form",
        }),
      });
      const data = await res.json();
      setVerificationResult({
        gateState: data.gateState,
        findings: data.findings || [],
        summary: data.summary || "",
      });
    } catch {
      // Offline fallback
      const offline = await runUnifiedVerification({
        entries,
        context: {
          business_type: businessType,
          currency: formData.currency,
          reporting_period: "October 2026",
          allowed_variance_pct: 0,
        },
      });
      setVerificationResult({
        gateState: offline.gateState,
        findings: offline.findings,
        summary: offline.summary,
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Check if verification has been performed and whether blocking issues exist
    if (!verificationResult || verificationResult.gateState === "blocked") {
      setGuardModalOpen(true);
      return;
    }

    // Passed quality gate
    setSubmissionSuccess(true);
    setGuardModalOpen(false);
  };

  // Helper to determine field flag class
  const getFieldFlagClass = (fieldName: string) => {
    if (!verificationResult) return "";
    const openFinding = verificationResult.findings.find(
      (f) => f.field === fieldName && f.status === "open"
    );
    if (!openFinding) return "";
    return openFinding.severity === "blocking" || openFinding.severity === "high"
      ? "field-flagged-blocking"
      : "field-flagged-warning";
  };

  return (
    <div className="page-shell">
      {/* Top Header */}
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo">
            <svg viewBox="0 0 24 24" fill="none" width="18" height="18">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div>
            <div className="topbar__title">Tasdeeq <span className="ur">تصدیق</span></div>
            <div className="topbar__sub">Controlled Form & Pre-Submission Guard Demo</div>
          </div>
        </div>

        <nav className="nav-tab-bar">
          <Link href="/" className="nav-tab-item">
            ← Main Web Workspace
          </Link>
          <span className="nav-tab-item nav-tab-item--active">
            Controlled Demo Form
          </span>
        </nav>
      </header>

      <main className="main-content">
        <div className="demo-form-container">
          {/* Extension Integration Banner */}
          <div className="guard-banner animate-in">
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "24px" }}>🔌</span>
              <div>
                <strong style={{ color: "var(--text-primary)" }}>Browser Extension Target Page</strong>
                <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                  This form is instrumented for both in-page Pre-Submission Guarding and the Tasdeeq Browser Extension.
                </p>
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="btn btn--ghost btn--sm" onClick={loadFlawedSample}>
                ⚡ Load Flawed Sample
              </button>
              <button className="btn btn--ghost btn--sm" onClick={loadOutlierSample}>
                🔍 Load Outlier Sample
              </button>
              <button className="btn btn--ghost btn--sm" onClick={loadCleanSample}>
                ✓ Load Clean Sample
              </button>
            </div>
          </div>

          {/* Form Card */}
          <div className="demo-form-card animate-in">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
              <div>
                <h1 style={{ fontSize: "20px", fontWeight: 700 }}>Supplier Payable Voucher Submission</h1>
                <p style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                  Enterprise ERP & Ledger Ingestion Portal (Controlled Demonstration Form)
                </p>
              </div>
              <button
                className="btn btn--secondary btn--sm"
                onClick={runVerification}
                disabled={isVerifying}
                id="btn-inspect-page"
              >
                {isVerifying ? "Verifying with Tasdeeq…" : "🛡️ Verify Form with Tasdeeq"}
              </button>
            </div>

            {/* Quality Gate Status Indicator on Form */}
            {verificationResult && (
              <div
                className={`alert ${
                  verificationResult.gateState === "blocked"
                    ? "alert--error"
                    : verificationResult.gateState === "needs_review"
                    ? "alert--warn"
                    : "alert--info"
                }`}
                style={{ marginBottom: "20px" }}
              >
                <span style={{ fontSize: "18px" }}>
                  {verificationResult.gateState === "blocked"
                    ? "🛑"
                    : verificationResult.gateState === "needs_review"
                    ? "⚖️"
                    : "✅"}
                </span>
                <div style={{ flex: 1 }}>
                  <strong>
                    {verificationResult.gateState === "blocked"
                      ? "Pre-Submission Guard Active: Submission Blocked"
                      : verificationResult.gateState === "needs_review"
                      ? "Pre-Submission Guard: Advisory Review Recommended"
                      : "Pre-Submission Guard: Form Verified & Clear for Release"}
                  </strong>
                  <div style={{ fontSize: "12px", marginTop: "3px" }}>
                    {verificationResult.summary}
                  </div>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} id="tasdeeq-demo-form">
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Vendor / Supplier Name *
                  </label>
                  <input
                    type="text"
                    name="vendor_name"
                    id="field-vendor_name"
                    className={`table-input ${getFieldFlagClass("vendor_name")}`}
                    value={formData.vendor_name}
                    onChange={(e) => handleChange("vendor_name", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Invoice / Voucher Number *
                  </label>
                  <input
                    type="text"
                    name="invoice_number"
                    id="field-invoice_number"
                    className={`table-input ${getFieldFlagClass("invoice_number")}`}
                    value={formData.invoice_number}
                    onChange={(e) => handleChange("invoice_number", e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px", marginBottom: "16px" }}>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Invoice Date *
                  </label>
                  <input
                    type="date"
                    name="date"
                    id="field-date"
                    className={`table-input ${getFieldFlagClass("date")}`}
                    value={formData.date}
                    onChange={(e) => handleChange("date", e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Currency *
                  </label>
                  <select
                    name="currency"
                    id="field-currency"
                    className={`table-input ${getFieldFlagClass("currency")}`}
                    value={formData.currency}
                    onChange={(e) => handleChange("currency", e.target.value)}
                  >
                    <option value="PKR">PKR (Pakistani Rupee)</option>
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: "12px", color: "var(--text-secondary)", display: "block", marginBottom: "4px" }}>
                    Business Classification
                  </label>
                  <input
                    type="text"
                    className="table-input"
                    value={businessType}
                    onChange={(e) => setBusinessType(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ background: "var(--bg-elevated)", padding: "16px", borderRadius: "var(--r-md)", marginBottom: "20px" }}>
                <div style={{ fontWeight: 600, fontSize: "13px", marginBottom: "12px", color: "var(--text-primary)" }}>
                  Itemized Line & Billing Details
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Description</label>
                    <input
                      type="text"
                      name="item_description"
                      id="field-item_description"
                      className={`table-input ${getFieldFlagClass("item_description")}`}
                      value={formData.item_description}
                      onChange={(e) => handleChange("item_description", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Quantity</label>
                    <input
                      type="number"
                      name="quantity"
                      id="field-quantity"
                      className={`table-input ${getFieldFlagClass("quantity")}`}
                      value={formData.quantity}
                      onChange={(e) => handleChange("quantity", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Unit Price</label>
                    <input
                      type="number"
                      name="unit_price"
                      id="field-unit_price"
                      className={`table-input ${getFieldFlagClass("unit_price")}`}
                      value={formData.unit_price}
                      onChange={(e) => handleChange("unit_price", e.target.value)}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Subtotal</label>
                    <input
                      type="number"
                      name="subtotal"
                      id="field-subtotal"
                      className={`table-input ${getFieldFlagClass("subtotal")}`}
                      value={formData.subtotal}
                      onChange={(e) => handleChange("subtotal", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)" }}>Tax / GST</label>
                    <input
                      type="number"
                      name="tax"
                      id="field-tax"
                      className={`table-input ${getFieldFlagClass("tax")}`}
                      value={formData.tax}
                      onChange={(e) => handleChange("tax", e.target.value)}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600 }}>Total Amount *</label>
                    <input
                      type="number"
                      name="total_amount"
                      id="field-total_amount"
                      className={`table-input ${getFieldFlagClass("total_amount")}`}
                      value={formData.total_amount}
                      onChange={(e) => handleChange("total_amount", e.target.value)}
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Form Submission Button */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
                <button
                  type="submit"
                  className="btn btn--primary btn--lg"
                  id="btn-submit-external"
                >
                  🚀 Submit Voucher to Accounting
                </button>
              </div>
            </form>

            {/* Submission Successful State */}
            {submissionSuccess && (
              <div className="alert alert--info animate-in" style={{ marginTop: "20px" }}>
                <span>🎉</span>
                <div>
                  <strong>Voucher Successfully Ingested!</strong>
                  <p style={{ margin: 0, fontSize: "12px" }}>
                    The transaction conformed to all quality policies and was committed to the database.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PRE-SUBMISSION GUARD MODAL */}
        {guardModalOpen && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(0,0,0,0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: "20px",
            }}
          >
            <div
              className="animate-in"
              style={{
                background: "var(--bg-surface)",
                border: "2px solid #f7574f",
                borderRadius: "var(--r-xl)",
                maxWidth: "540px",
                width: "100%",
                padding: "28px",
                boxShadow: "0 0 40px rgba(247,87,79,0.3)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" }}>
                <span style={{ fontSize: "36px" }}>🛑</span>
                <div>
                  <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f7574f" }}>
                    Tasdeeq Pre-Submission Guard
                  </h2>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", margin: 0 }}>
                    Submission Intercepted — Critical Quality Gate Enforcement
                  </p>
                </div>
              </div>

              <p style={{ fontSize: "13px", color: "var(--text-primary)", marginBottom: "16px" }}>
                {!verificationResult
                  ? "This record has not been verified through Tasdeeq. Policy requires pre-submission verification to catch clerical and numerical errors."
                  : `Release held: ${
                      verificationResult.findings.filter(
                        (f) => (f.severity === "blocking" || f.severity === "high") && f.status === "open"
                      ).length
                    } blocking discrepancies must be resolved before this voucher can be recorded.`}
              </p>

              {verificationResult && (
                <div
                  style={{
                    maxHeight: "180px",
                    overflowY: "auto",
                    background: "rgba(0,0,0,0.3)",
                    padding: "10px",
                    borderRadius: "var(--r-md)",
                    marginBottom: "16px",
                    fontSize: "12px",
                  }}
                >
                  {verificationResult.findings
                    .filter((f) => f.status === "open")
                    .map((f) => (
                      <div key={f.finding_id} style={{ marginBottom: "8px", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "6px" }}>
                        <strong style={{ color: f.severity === "blocking" || f.severity === "high" ? "#f7574f" : "#f7a94f" }}>
                          [{f.category.replace("_", " ").toUpperCase()}] {f.field}:
                        </strong>{" "}
                        {f.evidence}
                      </div>
                    ))}
                </div>
              )}

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  className="btn btn--secondary"
                  onClick={() => setGuardModalOpen(false)}
                >
                  Return to Form
                </button>
                <button
                  className="btn btn--primary"
                  onClick={() => {
                    setGuardModalOpen(false);
                    runVerification();
                  }}
                >
                  🛡️ Run Full Verification Now
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
