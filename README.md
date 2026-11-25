# 🌱 EcoRoute AI

**Responsible AI. Protected Identity. Trusted Decisions.**

EcoRoute AI is a privacy-focused, multi-model AI workspace designed to make AI usage more responsible, efficient, transparent, and secure. Unlike conventional AI chatbots, EcoRoute AI acts as an intelligent protection and optimization layer between users, their sensitive data, and external or locally hosted AI providers.

---

## 🎯 Why EcoRoute AI?

Organizations, professionals, and everyday users frequently paste confidential data into external AI tools without realizing the privacy, compliance, or efficiency implications. EcoRoute AI solves this by unifying privacy protection, deterministic ethics enforcement, prompt optimization, document integrity analysis, and multi-model routing in a single workspace.

| Typical AI Workspace | EcoRoute AI |
| :--- | :--- |
| Relies on one or a few static models | **Smart Model Router** selects models dynamically by task |
| Sends raw prompts directly to APIs | **Privacy Shield** redacts sensitive data before external calls |
| Minimal or opaque safety controls | **4-Level Ethics Engine** enforced on both frontend and backend |
| Manual prompt trimming | **Token Simplifier** automatically reduces unnecessary prompt length |
| Basic file uploads | **Document Intelligence** with text extraction & integrity checks |
| Generic privacy settings | **Consent Centre** + planned **Company Privacy Policy Guard** |

---

## 🏗️ Protection Pipeline Architecture

Every prompt and document attachment passes through EcoRoute AI's multi-stage pipeline before reaching an external or local AI provider:

```text
[ User Prompt / Document Attachment ]
                 │
                 ▼
┌─────────────────────────────────────────┐
│        EcoRoute AI Protection Layer     │
│                                         │
│  1. Privacy Shield (PII Redaction)      │
│  2. Ethics Enforcement (4-Level Guard)  │
│  3. Company Policy Guard (Planned)      │
│  4. Token Simplifier (Prompt Pruning)   │
│  5. Smart Model Router (Task Routing)   │
└─────────────────────────────────────────┘
                 │
                 ▼
[ Configured AI Provider (Cloud / Local) ]
                 │
                 ▼
[ AI Response Returned to Workspace ]
```

---

## ✨ Core Features

### 1. Multi-Model AI Workspace
* Connect multiple OpenAI-compatible API providers as well as locally hosted endpoints (e.g., **Unsloth Studio**).
* Manage multiple model profiles, set defaults, toggle individual profiles on/off, or manually override model selection anytime.

### 2. Smart Model Router
Automatically classifies user prompts into task categories (`SIMPLE`, `GENERAL`, `CODING`, `REASONING`, `SUMMARIZATION`) and routes requests to the best matching enabled model—with manual selection always taking priority.

### 3. Privacy Shield (Sensitive Information Protection)
Scans prompts and extracted document text for sensitive patterns and custom confidential terms, redacting them before external API calls:
* **Original:** `Summarize the financial record for customer Rahul Sharma. His account number is 1234567890.`
* **Redacted:** `Summarize the financial record for customer [REDACTED]. His account number is [REDACTED].`

### 4. Deterministic AI Ethics Enforcement Engine
Evaluates requests against responsible AI rules on both the frontend and backend before provider resolution:
* `ALLOWED`: Normal, legitimate requests proceed.
* `WARNING`: Potential concerns trigger an explanation and warning.
* `RESTRICTED`: Requests requiring safer handling are stopped per policy.
* `BLOCKED`: Harmful, fraudulent, or deceptive requests are stopped completely with a risk score, triggered rule, and safer alternatives.

### 5. Token Simplifier
Removes redundant filler words while strictly preserving code blocks, URLs, quoted text, and JSON structures—providing estimated token savings (`character length / 4`).

### 6. Multimodal Attachments & PDF Subsystem
* Supports up to **5 attachments per message** (max **10 MB** each) across `PDF`, `DOCX`, `TXT`, `CSV`, `XLSX`, `PPTX`, and image previews (`JPG`, `PNG`, `WEBP`).
* Includes file-signature validation, filename sanitization, explicit attachment consent, and a stabilized **PDF.js** extraction pipeline supporting multi-page documents and safe `ArrayBuffer` cloning.

### 7. Document Integrity Analysis & Fraud Detection
Inspects supported documents for suspicious alteration indicators—including revised marks, unusual score changes, alteration wording, PDF metadata anomalies, and signature presence (`UNSIGNED`, `UNVERIFIABLE`, `NOT_APPLICABLE`)—classifying files into `LOW RISK`, `REVIEW REQUIRED`, or `HIGH RISK`.

### 8. Privacy Policy & Consent Centre
Includes versioned Privacy Policy and AI Ethics agreements requiring explicit user acknowledgement, local consent timestamping, and automatic re-acknowledgement upon policy updates.

### 9. Impact Dashboard
Tracks token savings, efficiency metrics, and privacy redaction activity inside the workspace.

---

## 🛠️ Tech Stack

* **Frontend:** React.js + Vite
  * Services: `modelRouterService.js`, `aiService.js`, `attachmentService.js`, `documentIntegrityService.js`, `ethicsPolicy.js`
* **Backend:** Express.js
  * Handles profile/credential resolution, independent backend ethics validation, 10-minute request timeouts, and safe file handling (zero execution of uploaded files or macros).
* **AI Providers:** OpenAI-compatible cloud APIs & local endpoints (Unsloth Studio).

---

## 🚀 Getting Started

### Prerequisites
* **Node.js** (v18+ recommended)
* **npm** or **yarn**
* At least one OpenAI-compatible API key or local model server (e.g., Unsloth Studio)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/ecoroute-ai.git
   cd ecoroute-ai
   ```

2. **Install dependencies**
   ```bash
   # Install frontend and backend dependencies
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root/server directory as needed:
   ```env
   PORT=5000
   # Add any default provider endpoints or keys if applicable
   ```

4. **Run the application**
   ```bash
   # Start the Express backend
   npm run server

   # In a separate terminal, start the Vite frontend
   npm run dev
   ```

---

## 🗺️ Roadmap & Planned Refinements

* [ ] **Company-Specific Privacy Policy Guard:** Upload organizational privacy policies, extract rules, and flag or block employee prompts/attachments that violate internal data-handling policies.
* [ ] **Expanded Impact Dashboard:** Dedicated views for Token Savings, Privacy Impact, and estimated $\text{CO}_2$ emissions avoided (with documented estimation methodology).
* [ ] **UI/UX Refresh:** Retractable sidebar, separated API/Model and Privacy/Ethics settings, refined light/dark modes, and screen-recording-friendly typography.

---

## ⚠️ Known Limitations & Disclaimers

To maintain transparency, please note the following current prototype boundaries:
* **Estimates Only:** Token savings (`characters / 4`) and environmental impact metrics are estimates rather than provider-tokenizer or metered hardware measurements.
* **No OCR Yet:** Images can be previewed and scanned PDFs are safely detected, but optical character recognition (OCR) and multimodal image understanding are not yet implemented.
* **Heuristic Integrity Checks:** Document Integrity Analysis flags heuristic anomalies; it does not cryptographically verify PDF certificate chains, compare visual layouts, or verify records with issuing authorities. A `LOW RISK` score does not guarantee legal authenticity.
* **Detection Scope:** Privacy Shield and Ethics Enforcement rely on configured rules and detection patterns and do not constitute a legal compliance guarantee.

---

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).