// ══════════════════════════════════════════════
// TASDEEQ BROWSER EXTENSION — POPUP LOGIC
// ══════════════════════════════════════════════

let currentFields = [];
let currentFindings = [];
let currentSessionId = "";
let currentGateState = "not_checked";
let isHighlighted = false;

const API_BASE = "http://localhost:3001";

document.addEventListener("DOMContentLoaded", () => {
  const btnInspect = document.getElementById("btn-inspect");
  const btnVerify = document.getElementById("btn-verify");
  const btnHighlight = document.getElementById("btn-highlight-toggle");
  const btnOpenWorkspace = document.getElementById("btn-open-workspace");

  // ── 1. Inspect Active Page Form ───────────────────────────────────────────
  btnInspect.addEventListener("click", async () => {
    btnInspect.disabled = true;
    btnInspect.innerText = "Inspecting…";

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab || !tab.id) throw new Error("No active browser tab found");

      chrome.tabs.sendMessage(tab.id, { action: "INSPECT_PAGE" }, (response) => {
        btnInspect.disabled = false;
        btnInspect.innerText = "🔍 Inspect Form";

        if (!response || !response.fields || response.fields.length === 0) {
          alert("No form inputs found on this page. Navigate to a supported form (e.g. http://localhost:3001/demo-form).");
          return;
        }

        currentFields = response.fields;
        renderFieldsList(currentFields);
        btnVerify.disabled = false;
      });
    } catch (err) {
      btnInspect.disabled = false;
      btnInspect.innerText = "🔍 Inspect Form";
      alert("Could not inspect page: " + err.message);
    }
  });

  // ── 2. Run Tasdeeq Verification ──────────────────────────────────────────
  btnVerify.addEventListener("click", async () => {
    btnVerify.disabled = true;
    btnVerify.innerText = "Verifying…";

    const businessType = document.getElementById("ctx-business-type").value;
    const currency = document.getElementById("ctx-currency").value;

    const payload = {
      entries: currentFields,
      context: {
        business_type: businessType,
        currency: currency,
        reporting_period: "Current Period",
        allowed_variance_pct: 0,
      },
      source: "extension",
      sessionId: currentSessionId || undefined,
    };

    try {
      let res;
      try {
        res = await fetch(`${API_BASE}/api/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch {
        res = await fetch("http://localhost:3000/api/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Verification failed");

      currentFindings = data.findings || [];
      currentGateState = data.gateState;
      currentSessionId = data.sessionId;

      renderQualityGate(data.gateState, data.stats, data.summary);
      renderFindingsList(currentFindings);

      // Trigger highlight on page
      sendHighlightToPage(currentFindings, data.gateState, data.stats?.blocking || 0);
      isHighlighted = true;
      btnHighlight.innerText = "Clear Highlights";
    } catch (err) {
      alert("Verification error: " + err.message);
    } finally {
      btnVerify.disabled = false;
      btnVerify.innerText = "🛡️ Verify Entries";
    }
  });

  // ── 3. Toggle Page Highlights ────────────────────────────────────────────
  btnHighlight.addEventListener("click", async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab || !tab.id) return;

    if (isHighlighted) {
      chrome.tabs.sendMessage(tab.id, { action: "CLEAR_HIGHLIGHTS" });
      isHighlighted = false;
      btnHighlight.innerText = "Highlight on Page";
    } else {
      sendHighlightToPage(currentFindings, currentGateState);
      isHighlighted = true;
      btnHighlight.innerText = "Clear Highlights";
    }
  });

  // ── 4. Open in Full Web Workspace ────────────────────────────────────────
  btnOpenWorkspace.addEventListener("click", () => {
    const url = currentSessionId
      ? `${API_BASE}/?session=${encodeURIComponent(currentSessionId)}`
      : API_BASE;
    chrome.tabs.create({ url });
  });
});

// ── Render Captured Fields ───────────────────────────────────────────────────
function renderFieldsList(fields) {
  const section = document.getElementById("fields-section");
  const countEl = document.getElementById("fields-count");
  const listEl = document.getElementById("fields-list");

  section.classList.remove("section--hidden");
  countEl.innerText = fields.length;
  listEl.innerHTML = "";

  fields.forEach((f) => {
    const row = document.createElement("div");
    row.className = "field-row";
    row.innerHTML = `
      <span class="field-name">${f.label || f.field}:</span>
      <span class="field-val">${f.typed_value || "—"}</span>
    `;
    listEl.appendChild(row);
  });
}

// ── Render Quality Gate Banner ───────────────────────────────────────────────
function renderQualityGate(gateState, stats, summary) {
  const banner = document.getElementById("gate-banner");
  const icon = document.getElementById("gate-icon");
  const title = document.getElementById("gate-title");
  const sub = document.getElementById("gate-sub");

  banner.className = "gate-banner";

  if (gateState === "blocked") {
    banner.classList.add("gate-banner--blocked");
    icon.innerText = "🛑";
    title.innerText = `Quality Gate: Blocked (${stats.blocking} Errors)`;
    sub.innerText = "Blocking errors prevent form submission.";
  } else if (gateState === "needs_review") {
    banner.classList.add("gate-banner--review");
    icon.innerText = "⚖️";
    title.innerText = `Quality Gate: Needs Review (${stats.warnings} Warnings)`;
    sub.innerText = "Review warnings before release.";
  } else {
    banner.classList.add("gate-banner--ready");
    icon.innerText = "✅";
    title.innerText = "Quality Gate: Clear for Release";
    sub.innerText = "All data conforms to verification rules.";
  }
}

// ── Render Findings List ─────────────────────────────────────────────────────
function renderFindingsList(findings) {
  const section = document.getElementById("findings-section");
  const listEl = document.getElementById("findings-list");

  section.classList.remove("section--hidden");
  listEl.innerHTML = "";

  if (findings.length === 0) {
    listEl.innerHTML = `<div style="font-size:12px; color:#4ff7a9; padding:8px 0;">✓ All checks passed. Zero discrepancies detected.</div>`;
    return;
  }

  findings.forEach((f) => {
    const isBlocking = f.severity === "blocking" || f.severity === "high";
    const card = document.createElement("div");
    card.className = `finding-card-mini ${
      isBlocking ? "finding-card-mini--blocking" : "finding-card-mini--warning"
    }`;

    const hasFixValue = !!f.expected_value || !!f.document_value;
    const fixVal = f.document_value || f.expected_value || "";

    card.innerHTML = `
      <div class="finding-mini-top">
        <span>${f.label || f.field}</span>
        <span style="color:${isBlocking ? "#f7574f" : "#f7a94f"}; font-size:10px; font-weight:700;">
          ${f.category.replace(/_/g, " ").toUpperCase()}
        </span>
      </div>
      <div class="finding-mini-evidence">${f.evidence}</div>
      ${
        f.status === "open"
          ? `
        <div class="finding-mini-actions">
          ${
            hasFixValue
              ? `<button class="btn btn--primary btn-mini" data-action="autofix" data-id="${f.finding_id}" data-field="${f.field}" data-val="${fixVal}">
                  ✓ Fix on Form (${fixVal})
                </button>`
              : ""
          }
          <button class="btn btn--secondary btn-mini" data-action="accept" data-id="${f.finding_id}">
            ✓ Accept
          </button>
          <button class="btn btn--ghost btn-mini" data-action="dismiss" data-id="${f.finding_id}">
            ✕ Dismiss
          </button>
        </div>
      `
          : `<div style="color:#4ff7a9; font-size:10px;">✓ Resolved: ${f.status}</div>`
      }
    `;

    // Hook up buttons
    card.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        const action = e.target.getAttribute("data-action");
        const findingId = e.target.getAttribute("data-id");

        if (action === "autofix") {
          const field = e.target.getAttribute("data-field");
          const val = e.target.getAttribute("data-val");
          // Update in-page DOM input
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab && tab.id) {
            chrome.tabs.sendMessage(tab.id, { action: "AUTO_FIX_FIELD", field, value: val });
          }
          // Mark finding resolved
          const finding = currentFindings.find((item) => item.finding_id === findingId);
          if (finding) {
            finding.status = "resolved_corrected";
            finding.resolved_value = val;
            finding.resolution_reason = "Auto-corrected via extension";
          }
          recalculateGate();
        } else if (action === "accept") {
          const note = prompt("Enter justification for accepting this exception:", "Approved by business reviewer");
          if (note !== null) {
            const finding = currentFindings.find((item) => item.finding_id === findingId);
            if (finding) {
              finding.status = "resolved_accepted";
              finding.resolution_reason = note;
            }
            recalculateGate();
          }
        } else if (action === "dismiss") {
          const note = prompt("Enter reason for dismissing finding:", "Reviewed and deemed non-critical");
          if (note !== null) {
            const finding = currentFindings.find((item) => item.finding_id === findingId);
            if (finding) {
              finding.status = "dismissed";
              finding.resolution_reason = note;
            }
            recalculateGate();
          }
        }
      });
    });

    listEl.appendChild(card);
  });
}

// ── Recalculate Gate & Update Highlights ─────────────────────────────────────
function recalculateGate() {
  const openBlocking = currentFindings.filter(
    (f) => f.status === "open" && (f.severity === "blocking" || f.severity === "high")
  ).length;
  const openWarnings = currentFindings.filter(
    (f) => f.status === "open" && (f.severity === "warning" || f.severity === "medium")
  ).length;

  currentGateState = openBlocking > 0 ? "blocked" : openWarnings > 0 ? "needs_review" : "ready_for_release";

  renderQualityGate(
    currentGateState,
    { blocking: openBlocking, warnings: openWarnings },
    "Updated via in-extension review."
  );
  renderFindingsList(currentFindings);
  sendHighlightToPage(currentFindings, currentGateState, openBlocking);
}

// ── Send In-Page Highlights ──────────────────────────────────────────────────
async function sendHighlightToPage(findings, gateState, blockingCount = 0) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      action: "HIGHLIGHT_FINDINGS",
      findings,
      gateState,
      blockingCount,
    });
  }
}
