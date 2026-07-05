# Personal Finance Agent

An automated personal finance tracking agent built with n8n. When a payslip screenshot arrives in Gmail, this workflow extracts financial data using OCR, fetches live gold prices, logs everything to a Google Sheet, and sends an AI-generated financial summary via Telegram — all without any manual input.

---

## What It Does

1. **Monitors Gmail** for incoming payslip emails (filtered by keyword and sender)
2. **Extracts the payslip image** from the email HTML using Base64 decoding
3. **Runs OCR** via Google Cloud Vision API to read text from the payslip screenshot
4. **Parses key values** using JavaScript regex — pay date, net pay, pension contribution, and weeks until next pay
5. **Fetches live gold price** in GBP per gram via the CoinGecko API (no API key required)
6. **Calculates the new row number** and auto-generates spreadsheet formulas for financial tracking columns
7. **Copies static values** (subscriptions, bills, debt etc.) from the previous row automatically
8. **Appends a new row** to a Google Sheet with all extracted and calculated values
9. **Generates an AI financial summary** using Groq (Llama 3) describing pay, gold holdings value, and weeks to next pay
10. **Sends the summary** to a personal Telegram bot

---

## Workflow Diagram

```
Gmail Trigger
     |
     v
Get existing rows (Google Sheets)
     |
     v
Extract Base64 image from email HTML (JavaScript)
     |
     v
Google Cloud Vision OCR (HTTP Request)
     |
     v
Parse payslip data + calculate formulas (JavaScript)
     |
     v
Fetch live gold price — CoinGecko API (HTTP Request)
     |
     v
Append row to Google Sheet
     |
     v
Generate AI summary — Groq / Llama 3 (HTTP Request)
     |
     v
Send Telegram message
```

---

## Tech Stack

| Tool | Purpose |
|---|---|
| [n8n](https://n8n.io) | Workflow automation (self-hosted) |
| Gmail API (OAuth2) | Email trigger |
| Google Cloud Vision API | OCR — text extraction from payslip image |
| Google Sheets API (OAuth2) | Financial data logging |
| CoinGecko API | Live GBP gold price (free, no key required) |
| Groq API (Llama 3) | AI-generated financial summary (free tier) |
| Telegram Bot API | Delivery of summary message |
| JavaScript | Data parsing, regex extraction, formula generation |

---

## Data Extracted Automatically

- Pay date
- Net pay
- Pension contribution (parsed from OCR text)
- Weeks until next pay (calculated from last Friday of month logic)
- Live gold price per gram (GBP)
- Total gold holdings value
- Previous row values (subscriptions, bills, debt, repayments, ISA contributions etc.)
- Auto-populated spreadsheet formulas (wallet balance, net worth, NW change, gold value, value diff)

---

## Prerequisites

- [n8n](https://docs.n8n.io/hosting/) installed locally or self-hosted
- Google Cloud project with the following APIs enabled:
  - Cloud Vision API
  - Gmail API
  - Google Sheets API
  - Google Drive API
- OAuth2 credentials for Gmail and Google Sheets
- [Groq](https://console.groq.com) account (free tier)
- Telegram bot (created via [@BotFather](https://t.me/botfather))

---

## Setup

1. **Import the workflow** into n8n (Settings > Import Workflow > paste JSON)
2. **Configure credentials:**
   - Gmail OAuth2 — connect your Google account
   - Google Sheets OAuth2 — connect your Google account
   - Telegram — add your bot token
3. **Replace placeholders** in the workflow:
   - `YOUR_GOOGLE_VISION_API_KEY` — your Google Cloud Vision API key
   - `YOUR_GROQ_API_KEY` — your Groq API key
   - `YOUR_SPREADSHEET_ID` — your Google Sheet ID (from the URL)
   - `YOUR_TELEGRAM_CHAT_ID` — your Telegram chat ID (get via getUpdates)
   - `YOUR_WORK_EMAIL` — the sender email to filter payslip emails from
4. **Set up your Google Sheet** with the column headers matching those in the workflow mapping
5. **Activate the workflow** — it will poll Gmail every minute

---

## Notes

- The workflow runs locally — your laptop must be on and n8n must be running (`npx n8n`)
- The payslip must be embedded in the email as a Base64-encoded image (inline screenshot)
- The pension contribution parser looks for the label `NOB UK 1` in the OCR text — update the regex in the Code node if your payslip uses a different label
- Some columns (credit score, ISA values, pension pot) are flagged as `please input` and require manual entry after each run

---

## Author

Built by Luke as part of a personal AI toolkit project — learning to build real automation workflows with n8n, APIs, and LLMs.
