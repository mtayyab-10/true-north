// ══════════════════════════════════════════════
// TASDEEQ BROWSER EXTENSION — CONTENT SCRIPT
// Plain JavaScript (Strictly no TypeScript syntax)
// ══════════════════════════════════════════════

let currentGuardState = {
  isArmed: false,
  gateState: "not_checked",
  blockingCount: 0,
  findings: [],
};

// ── Discover Form Inputs on Active Page ───────────────────────────────────────
function extractFormFields() {
  const inputs = Array.from(
    document.querySelectorAll("input:not([type='hidden']):not([type='password']):not([type='submit']):not([type='button']), select, textarea")
  );

  const extracted = [];
  inputs.forEach((el, index) => {
    // Determine label
    let label = "";
    if (el.id) {
      const labelEl = document.querySelector("label[for='" + el.id + "']");
      if (labelEl) label = labelEl.innerText.trim();
    }
    if (!label) {
      const parentLabel = el.closest("label");
      if (parentLabel) {
        label = parentLabel.innerText.replace(el.value, "").trim();
      }
    }
    if (!label && el.placeholder) {
      label = el.placeholder.trim();
    }
    if (!label && el.getAttribute("aria-label")) {
      label = el.getAttribute("aria-label");
    }
    if (!label && el.name) {
      label = el.name.replace(/[_-]/g, " ");
    }

    // Determine normalized field key
    let field = el.name || el.id || ("field_" + index);
    const lower = (field + " " + label).toLowerCase();
    if (lower.includes("vendor") || lower.includes("supplier") || lower.includes("shop")) field = "vendor_name";
    else if (lower.includes("invoice") || lower.includes("voucher") || lower.includes("bill")) field = "invoice_number";
    else if (lower.includes("date")) field = "date";
    else if (lower.includes("total") && !lower.includes("subtotal") && !lower.includes("line")) field = "total_amount";
    else if (lower.includes("subtotal")) field = "subtotal";
    else if (lower.includes("tax") || lower.includes("gst") || lower.includes("vat")) field = "tax";
    else if (lower.includes("qty") || lower.includes("quantity")) field = "quantity";
    else if (lower.includes("unit price") || lower.includes("rate") || lower.includes("price")) field = "unit_price";
    else if (lower.includes("currency")) field = "currency";
    else if (lower.includes("item") || lower.includes("desc") || lower.includes("product")) field = "item_description";

    const typedVal = el.value || "";

    extracted.push({
      id: el.id || ("tasdeeq_elem_" + index),
      field: field,
      label: label || field,
      typed_value: typedVal,
      field_type: el.type || el.tagName.toLowerCase(),
    });
  });

  return extracted;
}

// ── Highlight Fields On-Screen ───────────────────────────────────────────────
function applyHighlights(findings) {
  clearHighlights();

  findings.forEach((f) => {
    if (f.status !== "open") return;

    // Find matching DOM elements
    const selector = "input[name='" + f.field + "'], input#" + f.field + ", input#field-" + f.field + ", [name*='" + f.field + "']";
    const matches = document.querySelectorAll(selector);

    matches.forEach((el) => {
      const isBlocking = f.severity === "blocking" || f.severity === "high";
      el.classList.add(isBlocking ? "tasdeeq-highlight-blocking" : "tasdeeq-highlight-warning");

      // Create floating badge if not already added
      if (!el.nextElementSibling || !el.nextElementSibling.classList.contains("tasdeeq-field-badge")) {
        const badge = document.createElement("div");
        badge.className = "tasdeeq-field-badge " + (isBlocking ? "tasdeeq-field-badge--blocking" : "tasdeeq-field-badge--warning");
        badge.setAttribute("data-tasdeeq-badge", "true");
        badge.innerHTML = "<span>" + (isBlocking ? "🛑" : "⚠️") + "</span> <span>" + (f.evidence || f.label || "Issue detected") + "</span>";
        el.parentNode.insertBefore(badge, el.nextSibling);
      }
    });
  });
}

function clearHighlights() {
  document.querySelectorAll(".tasdeeq-highlight-blocking, .tasdeeq-highlight-warning").forEach((el) => {
    el.classList.remove("tasdeeq-highlight-blocking", "tasdeeq-highlight-warning");
  });
  document.querySelectorAll("[data-tasdeeq-badge='true']").forEach((b) => b.remove());
}

// ── In-Page Pre-Submission Interception Guard ─────────────────────────────────
function showGuardToast(blockingCount, sampleEvidence) {
  const existing = document.getElementById("tasdeeq-guard-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.id = "tasdeeq-guard-toast";
  toast.className = "tasdeeq-guard-toast";
  toast.innerHTML = [
    '<div class="tasdeeq-guard-toast__title">',
    '  <span>🛑</span> Tasdeeq Pre-Submission Guard',
    '</div>',
    '<div class="tasdeeq-guard-toast__body">',
    '  Submission blocked: <strong>' + blockingCount + ' blocking issue(s)</strong> must be resolved before this form can be submitted.',
    '  <br/><br/>',
    '  <em>' + (sampleEvidence || "Review flagged fields highlighted on the page.") + '</em>',
    '</div>',
    '<div style="display:flex; justify-content: flex-end; gap: 8px;">',
    '  <button class="tasdeeq-guard-toast__btn" id="tasdeeq-toast-dismiss">Review &amp; Fix</button>',
    '</div>'
  ].join("\n");

  document.body.appendChild(toast);
  const dismissBtn = document.getElementById("tasdeeq-toast-dismiss");
  if (dismissBtn) {
    dismissBtn.addEventListener("click", () => {
      toast.remove();
    });
  }
}

// Intercept form submissions if blocking issues exist
document.addEventListener(
  "submit",
  (e) => {
    if (currentGuardState.isArmed && currentGuardState.gateState === "blocked") {
      e.preventDefault();
      e.stopPropagation();
      const firstBlocking = currentGuardState.findings.find(
        (f) => (f.severity === "blocking" || f.severity === "high") && f.status === "open"
      );
      showGuardToast(
        currentGuardState.blockingCount,
        firstBlocking ? firstBlocking.evidence : undefined
      );
    }
  },
  true
);

// ── Message Listener from Extension Popup ────────────────────────────────────
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "INSPECT_PAGE") {
    const fields = extractFormFields();
    sendResponse({ success: true, fields: fields, url: window.location.href, title: document.title });
    return true;
  }

  if (request.action === "HIGHLIGHT_FINDINGS") {
    applyHighlights(request.findings || []);
    currentGuardState = {
      isArmed: true,
      gateState: request.gateState,
      blockingCount: request.blockingCount || 0,
      findings: request.findings || [],
    };
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "CLEAR_HIGHLIGHTS") {
    clearHighlights();
    currentGuardState.isArmed = false;
    sendResponse({ success: true });
    return true;
  }

  if (request.action === "AUTO_FIX_FIELD") {
    const selector = "input[name='" + request.field + "'], input#" + request.field + ", input#field-" + request.field;
    const el = document.querySelector(selector);
    if (el) {
      el.value = request.value;
      el.dispatchEvent(new Event("input", { bubbles: true }));
      el.dispatchEvent(new Event("change", { bubbles: true }));
      el.classList.remove("tasdeeq-highlight-blocking", "tasdeeq-highlight-warning");
    }
    sendResponse({ success: true });
    return true;
  }
});
