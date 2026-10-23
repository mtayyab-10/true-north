import {
  runDeterministicChecks,
  runStatisticalSignals,
  runContextAndUncertaintyChecks,
  evaluateQualityGate,
  runUnifiedVerification,
} from "./src/lib/verification-engine.js";

console.log("=== TASDEEQ AUTOMATED TEST SUITE ===");

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`✅ PASS: ${name}`);
    passed++;
  } else {
    console.error(`❌ FAIL: ${name}`);
    failed++;
  }
}

// Test 1: Deterministic Arithmetic Check
const arithmeticSample = [
  { id: "1", field: "vendor_name", typed_value: "Al-Kareem Store" },
  { id: "2", field: "invoice_number", typed_value: "INV-100" },
  { id: "3", field: "date", typed_value: "2026-10-15" },
  { id: "4", field: "quantity", typed_value: "5" },
  { id: "5", field: "unit_price", typed_value: "1000" },
  { id: "6", field: "total_amount", typed_value: "99999" }, // Math mismatch: 5 x 1000 = 5000 != 99999
];

const detFindings = runDeterministicChecks(arithmeticSample);
const mathFinding = detFindings.find((f) => f.rule_id === "RULE_MATH_MISMATCH");
assert(!!mathFinding, "Deterministic check detects quantity * unit_price arithmetic mismatch");
assert(mathFinding?.severity === "blocking", "Arithmetic mismatch is marked blocking");

// Test 2: Missing Required Field
const missingSample = [
  { id: "1", field: "vendor_name", typed_value: "" }, // missing vendor
  { id: "2", field: "invoice_number", typed_value: "INV-100" },
  { id: "3", field: "date", typed_value: "2026-10-15" },
  { id: "4", field: "total_amount", typed_value: "5000" },
];
const missingFindings = runDeterministicChecks(missingSample);
const reqFinding = missingFindings.find((f) => f.rule_id === "RULE_REQ_FIELD" && f.field === "vendor_name");
assert(!!reqFinding, "Missing required vendor name is detected as a blocking rule violation");

// Test 3: Statistical Benchmark Signal
const outlierSample = [
  { id: "1", field: "vendor_name", typed_value: "Basmati Rice Supplier" },
  { id: "2", field: "unit_price", typed_value: "35000" }, // 10x market normal of 3,200
  { id: "3", field: "item_description", typed_value: "Basmati Rice 25kg" },
];
const statFindings = runStatisticalSignals(outlierSample);
const priceOutlier = statFindings.find((f) => f.rule_id === "STAT_PRICE_OUTLIER_HIGH");
assert(!!priceOutlier, "Statistical benchmark flags unit price 10x higher than market baseline as contextual suspicion");
assert(priceOutlier?.category === "contextual_suspicion", "Category is correctly contextual_suspicion");

// Test 4: Quality Gate Evaluation
const openBlockingGate = evaluateQualityGate(detFindings);
assert(openBlockingGate.gateState === "blocked", "Quality gate blocks release when open blocking violations exist");

// Resolve finding and re-evaluate
const resolvedFindings = detFindings.map((f) => ({ ...f, status: "resolved_corrected" }));
const clearGate = evaluateQualityGate(resolvedFindings);
assert(clearGate.gateState === "ready_for_release", "Quality gate allows release when all blocking findings are resolved");

console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
process.exit(failed > 0 ? 1 : 0);
