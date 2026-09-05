# Personal Finance Agent

An n8n workflow that turns a payslip screenshot emailed to Gmail into a fully
populated row in a personal-finance Google Sheet — OCR, parsing, a live gold
price, calculated formulas, and an AI summary to Telegram, with no manual input.

## How it works

1. **Gmail trigger** polls for payslip emails from a chosen sender.
2. A **Code node** extracts the inline Base64 image from the email HTML.
3. **Google Cloud Vision** (`TEXT_DETECTION`) OCRs the screenshot.
4. A second **Code node** parses the OCR text with regex — pay date, net pay,
   pension contribution — and derives weeks until next payday from a "last
   Friday of the month" rule.
5. **CoinGecko** supplies the current GBP gold price per gram.
6. The workflow computes the new row number and builds the sheet formulas
   (wallet balance, net worth, net-worth change, gold value), carrying static
   columns (subscriptions, bills, debt) forward from the previous row.
7. **Google Sheets** gets the new row appended.
8. **Groq (Llama 3.1)** writes a short summary, delivered via the
   **Telegram Bot API**.

```
Gmail trigger -> extract image -> Vision OCR -> parse + formulas
     -> gold price (CoinGecko) -> append row (Sheets) -> AI summary (Groq) -> Telegram
```

## Tech stack

| Component | Role |
|---|---|
| [n8n](https://n8n.io) | Self-hosted workflow orchestration |
| Gmail API (OAuth2) | Email trigger and payslip source |
| Google Cloud Vision | OCR (`TEXT_DETECTION`) |
| Google Sheets API (OAuth2) | Financial ledger |
| CoinGecko API | Live GBP gold price (no key required) |
| Groq (Llama 3.1) | Natural-language summary |
| Telegram Bot API | Summary delivery |
| JavaScript | OCR parsing, date logic, formula generation |

## Fields extracted from the payslip

Pay date, net pay, pension contribution, and weeks until next payday (derived).
Gold price, holdings value, and the sheet formulas are calculated downstream; a
few columns (credit score, ISA and pension-pot balances) are left for manual
entry.

## Extraction eval

`eval/payslip-eval.js` is a golden-dataset test for the OCR parsing node,
modelled on the retrieval eval in
[Kcal-Tracker](https://github.com/Luke-AI-Developments/Kcal-Tracker): a fixed
set of known-correct examples, run through the real extraction code, scored per
field.

- **Dataset** — 12 synthetic payslips (invented names and figures, realistic UK
  layout; no real payslip data in the repo). Cases cover clean reads plus common
  OCR and layout noise: `£` misread as `E`, a year-to-date column after the
  `Net Pay` label, the pension figure inline with its label, a date of birth
  above the pay date, a missing space in `Net Pay`, and a December date whose
  next-payday calculation rolls into the following year.
- **Method** — the eval loads `personal-finance-agent.json`, extracts the
  JavaScript from the parsing node, and runs it directly, so it cannot drift
  from the deployed workflow. No dependencies: `node eval/payslip-eval.js`.
- **Scoring** — exact match for the pay date and the integer weeks-to-next-pay
  value; ±0.01 tolerance for net pay and pension contribution after normalising
  currency symbols and thousands separators.

**Result: 93.8% field-level pass rate (45 / 48 assertions), 10 of 12 payslips
fully correct.**

| Field | Pass rate |
|---|---|
| Net pay | 12 / 12 |
| Pay date | 11 / 12 |
| Pension contribution | 11 / 12 |
| Weeks to next pay | 11 / 12 |

The net-pay matcher was widened as a direct result of this eval: it previously
required a literal `£` and took the last amount after the label, so an OCR'd
`E`, a missing symbol, a spaceless `NetPay`, or a trailing year-to-date column
all defeated it. The two remaining failures share one payslip that prints a date
of birth above the pay date (the date regex takes the first `DD/MM/YYYY` it
sees, which also skews the weeks calculation) and one that places the pension
figure on the same line as its `NOB UK 1` label.

**Limitation:** the 12 cases are hand-written in a single broad payslip style,
so the score reflects the parser's handling of anticipated failure modes, not
the true distribution of a specific employer's payslip images.

## Setup

**Prerequisites:** a self-hosted [n8n](https://docs.n8n.io/hosting/) instance; a
Google Cloud project with the Vision, Gmail, Sheets, and Drive APIs enabled;
OAuth2 credentials for Gmail and Sheets; a [Groq](https://console.groq.com) API
key; and a Telegram bot from [@BotFather](https://t.me/botfather).

1. Import `personal-finance-agent.json` into n8n.
2. Connect the Gmail, Google Sheets, and Telegram credentials.
3. Replace the placeholders: `YOUR_GOOGLE_VISION_API_KEY`, `YOUR_GROQ_API_KEY`,
   `YOUR_SPREADSHEET_ID`, `YOUR_TELEGRAM_CHAT_ID`, `YOUR_WORK_EMAIL`.
4. Create the Google Sheet with column headers matching the workflow's field
   mapping.
5. Activate the workflow.

## Notes

- n8n must be running for the Gmail poll to fire.
- The payslip must be an inline Base64 image in the email body.
- The pension parser keys on the label `NOB UK 1`; adjust the regex in the
  parsing node for a different payslip format.

---

Built by Luke as part of a personal automation toolkit.
