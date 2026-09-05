/**
 * Payslip OCR extraction eval — golden-dataset style.
 *
 * Same pattern as the Kcal-Tracker retrieval eval (see that repo's
 * rag/eval.js): a fixed set of known-correct examples, run through the
 * *real* extraction logic, scored per field against expected values.
 *
 * What "the real extraction logic" means here: this file does not
 * re-implement the parser. It reads personal-finance-agent.json, pulls
 * the JavaScript out of the "Code in JavaScript1" node (the node that
 * turns Google Cloud Vision OCR text into pay date / net pay / pension
 * contribution / weeks-to-next-pay), and executes that exact source with
 * a stub `$()` standing in for n8n. If the workflow's regexes change,
 * this eval picks the change up automatically.
 *
 * The payslip text in `cases` is entirely fabricated — invented names,
 * invented employers, invented numbers, in realistic UK-payslip layout.
 * No real payslip data is in this repo.
 *
 * Scoring per field type:
 *   - payslipDate ............ exact string match (a date is right or wrong)
 *   - netPay ................. numeric, ±0.01 tolerance after stripping the
 *                             currency symbol / thousands commas / spaces,
 *                             so OCR formatting drift doesn't fail a
 *                             numerically-correct read
 *   - pensionContribution ... numeric, ±0.01 tolerance; when the payslip
 *                             has no pension line the expected value is
 *                             `null` and an empty string is the pass
 *   - weeksToNextPay ........ exact integer match (it's a date calculation,
 *                             not an OCR read — no tolerance is warranted)
 *
 * Run: node eval/payslip-eval.js
 */

const fs = require("fs");
const path = require("path");

const WORKFLOW = path.join(__dirname, "..", "personal-finance-agent.json");
const PARSE_NODE = "Code in JavaScript1";

// ---------------------------------------------------------------------------
// Load the real parser out of the n8n workflow.
// ---------------------------------------------------------------------------

function loadExtractor() {
  const wf = JSON.parse(fs.readFileSync(WORKFLOW, "utf8"));
  const node = (wf.nodes || []).find((n) => n.name === PARSE_NODE);
  if (!node || !node.parameters || typeof node.parameters.jsCode !== "string") {
    throw new Error(
      `Could not find a Code node named "${PARSE_NODE}" with jsCode in ${WORKFLOW}. ` +
        `If the workflow was restructured, update PARSE_NODE in this file.`
    );
  }
  const jsCode = node.parameters.jsCode;

  // The node body is trusted source from this repo's own committed
  // workflow file — it is not interpolated with anything, so running it
  // via `new Function` is just "execute the workflow's code as written".
  const compiled = new Function("$", jsCode); // eslint-disable-line no-new-func

  return function extract(ocrText) {
    // Minimal n8n shim: the parse node only reads two upstream nodes.
    const prevRows = [
      {
        json: {
          subs: "0", bills: "0", debt: "0", repayment: "0",
          "JA contribution": "0", "cc balance": "0", "credit score": "0",
          "add pension": "0", "pension pot": "0", "lisa con": "0",
          "isa con": "0", gold: "0",
        },
      },
    ];
    const $ = (name) => {
      if (name === "HTTP Request") {
        return {
          first: () => ({
            json: { responses: [{ textAnnotations: [{ description: ocrText }] }] },
          }),
        };
      }
      if (name === "Get row(s) in sheet") {
        return { all: () => prevRows };
      }
      throw new Error(`parse node referenced an unexpected upstream node: ${name}`);
    };
    return compiled($)[0].json;
  };
}

// ---------------------------------------------------------------------------
// Golden dataset — all synthetic. `expected` is the correct reading of the
// payslip, independent of what the current regexes happen to return.
// ---------------------------------------------------------------------------

const cases = [
  {
    name: "clean monthly payslip",
    ocr: [
      "NORTHWIND TRADING LTD",
      "Payslip for: Alex Morgan",
      "Pay Date 25/04/2025",
      "Payment Method BACS",
      "Gross Pay £2,850.00",
      "PAYE Tax £372.00",
      "National Insurance £198.40",
      "NOB UK 1",
      "£142.50",
      "Net Pay £2,137.10",
    ].join("\n"),
    expected: { payslipDate: "25/04/2025", netPay: 2137.10, pensionContribution: 142.50, weeksToNextPay: 5 },
  },
  {
    name: "five-figure net, comma thousands",
    ocr: [
      "Pay Date 20/06/2025",
      "Gross Pay £14,200.00",
      "NOB UK 1",
      "£1,050.00",
      "Net Pay £11,480.75",
    ].join("\n"),
    expected: { payslipDate: "20/06/2025", netPay: 11480.75, pensionContribution: 1050.00, weeksToNextPay: 5 },
  },
  {
    name: "OCR reads £ as E on the amount lines",
    ocr: [
      "GENERIC HOLDINGS PLC",
      "Pay Date 24/01/2025",
      "NOB UK 1",
      "E96.00",
      "Net Pay E1,912.44",
    ].join("\n"),
    expected: { payslipDate: "24/01/2025", netPay: 1912.44, pensionContribution: 96.00, weeksToNextPay: 5 },
  },
  {
    name: "period and year-to-date columns after 'Net Pay'",
    ocr: [
      "Pay Date 28/03/2025",
      "Payments and Deductions",
      "NOB UK 1",
      "£110.00",
      "Net Pay",
      "Period £1,730.20",
      "Year to Date £8,940.60",
    ].join("\n"),
    expected: { payslipDate: "28/03/2025", netPay: 1730.20, pensionContribution: 110.00, weeksToNextPay: 4 },
  },
  {
    name: "no pension line on the payslip",
    ocr: [
      "Pay Date 15/09/2025",
      "Gross Pay £1,980.00",
      "Tax £210.00",
      "Net Pay £1,620.00",
    ].join("\n"),
    expected: { payslipDate: "15/09/2025", netPay: 1620.00, pensionContribution: null, weeksToNextPay: 7 },
  },
  {
    name: "date of birth printed before the pay date",
    ocr: [
      "Tax Code 1257L   Date of Birth 12/03/1990",
      "Pay Date 30/05/2025",
      "NOB UK 1",
      "£130.00",
      "Net Pay £2,240.00",
    ].join("\n"),
    expected: { payslipDate: "30/05/2025", netPay: 2240.00, pensionContribution: 130.00, weeksToNextPay: 4 },
  },
  {
    name: "clean payslip, different employer layout",
    ocr: [
      "BLUE HARBOUR LOGISTICS",
      "Pay Date 22/08/2025",
      "Gross Pay £3,410.00",
      "NOB UK 1",
      "£170.50",
      "Net Pay £2,560.90",
    ].join("\n"),
    expected: { payslipDate: "22/08/2025", netPay: 2560.90, pensionContribution: 170.50, weeksToNextPay: 5 },
  },
  {
    name: "pension amount on the same line as its label",
    ocr: [
      "Pay Date 26/09/2025",
      "NOB UK 1 £140.00",
      "Net Pay £2,090.00",
    ].join("\n"),
    expected: { payslipDate: "26/09/2025", netPay: 2090.00, pensionContribution: 140.00, weeksToNextPay: 5 },
  },
  {
    name: "several deduction amounts before net pay",
    ocr: [
      "Pay Date 05/05/2025",
      "PAYE £305.00",
      "NI £176.20",
      "NOB UK 1",
      "£125.00",
      "Net Pay £1,884.30",
    ].join("\n"),
    expected: { payslipDate: "05/05/2025", netPay: 1884.30, pensionContribution: 125.00, weeksToNextPay: 8 },
  },
  {
    name: "December payslip (next-pay calc rolls into next year)",
    ocr: [
      "Pay Date 12/12/2025",
      "NOB UK 1",
      "£0.00",
      "Net Pay £2,015.00",
    ].join("\n"),
    expected: { payslipDate: "12/12/2025", netPay: 2015.00, pensionContribution: 0.00, weeksToNextPay: 7 },
  },
  {
    name: "OCR drops the space in 'Net Pay'",
    ocr: [
      "Pay Date 08/11/2025",
      "NOB UK 1",
      "£155.00",
      "NetPay £2,300.00",
    ].join("\n"),
    expected: { payslipDate: "08/11/2025", netPay: 2300.00, pensionContribution: 155.00, weeksToNextPay: 7 },
  },
  {
    name: "clean payslip, ampersand in employer name",
    ocr: [
      "CEDAR & STONE ACCOUNTANCY",
      "Pay Date 27/06/2025",
      "Gross Pay £2,720.00",
      "NOB UK 1",
      "£136.00",
      "Net Pay £2,044.88",
    ].join("\n"),
    expected: { payslipDate: "27/06/2025", netPay: 2044.88, pensionContribution: 136.00, weeksToNextPay: 4 },
  },
];

// ---------------------------------------------------------------------------
// Per-field scorers. Each returns { ok, actual, note }.
// ---------------------------------------------------------------------------

const MONEY_TOLERANCE = 0.01;

function toNumber(raw) {
  if (raw === undefined || raw === null) return NaN;
  return parseFloat(String(raw).replace(/[£E,\s]/g, ""));
}

const scorers = {
  payslipDate(actual, expected) {
    return { ok: actual === expected, actual: actual === "" ? "(empty)" : actual };
  },
  netPay(actual, expected) {
    const a = toNumber(actual);
    if (Number.isNaN(a)) return { ok: false, actual: actual === "" ? "(empty)" : String(actual) };
    return { ok: Math.abs(a - expected) <= MONEY_TOLERANCE, actual: a.toFixed(2) };
  },
  pensionContribution(actual, expected) {
    if (expected === null) {
      return { ok: actual === "" || actual === undefined, actual: actual === "" ? "(none)" : String(actual) };
    }
    const a = toNumber(actual);
    if (Number.isNaN(a)) return { ok: false, actual: actual === "" ? "(empty)" : String(actual) };
    return { ok: Math.abs(a - expected) <= MONEY_TOLERANCE, actual: a.toFixed(2) };
  },
  weeksToNextPay(actual, expected) {
    return { ok: actual === expected, actual: String(actual) };
  },
};

const FIELDS = ["payslipDate", "netPay", "pensionContribution", "weeksToNextPay"];

// ---------------------------------------------------------------------------

function main() {
  const extract = loadExtractor();
  const fieldStats = Object.fromEntries(FIELDS.map((f) => [f, { pass: 0, fail: 0 }]));
  const failuresByCase = [];
  let assertions = 0;
  let passes = 0;

  console.log(`Payslip OCR extraction eval — ${cases.length} synthetic payslips, ${FIELDS.length} fields each\n`);

  for (const testCase of cases) {
    const out = extract(testCase.ocr);
    const marks = [];
    const misses = [];

    for (const field of FIELDS) {
      const { ok, actual } = scorers[field](out[field], testCase.expected[field]);
      assertions++;
      if (ok) {
        passes++;
        fieldStats[field].pass++;
        marks.push(`✓ ${field}`);
      } else {
        fieldStats[field].fail++;
        marks.push(`✗ ${field}`);
        const want = testCase.expected[field] === null ? "(none)" : testCase.expected[field];
        misses.push(`      ${field}: expected ${want}, got ${actual}`);
      }
    }

    const allOk = misses.length === 0;
    console.log(`  ${allOk ? "PASS" : "FAIL"}  ${testCase.name}`);
    console.log(`        ${marks.join("   ")}`);
    for (const m of misses) console.log(m);
    if (!allOk) failuresByCase.push(testCase.name);
  }

  const rate = (passes / assertions) * 100;

  console.log("\n=== Summary ===");
  console.log(`Field assertions passed: ${passes}/${assertions} = ${rate.toFixed(1)}%`);
  console.log(`Cases fully correct:     ${cases.length - failuresByCase.length}/${cases.length}`);

  console.log("\nPer-field pass rate (worst first):");
  const ranked = FIELDS.slice().sort(
    (a, b) => fieldStats[b].fail - fieldStats[a].fail || a.localeCompare(b)
  );
  for (const field of ranked) {
    const { pass, fail } = fieldStats[field];
    const total = pass + fail;
    console.log(
      `  ${field.padEnd(20)} ${pass}/${total} = ${((pass / total) * 100).toFixed(0)}%` +
        (fail ? `   (${fail} fail${fail > 1 ? "s" : ""})` : "")
    );
  }

  const worst = ranked[0];
  if (fieldStats[worst].fail > 0) {
    console.log(`\nMost failure-prone field: ${worst} (${fieldStats[worst].fail} of ${cases.length} cases)`);
  }
}

main();
