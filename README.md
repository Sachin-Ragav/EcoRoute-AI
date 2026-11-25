# EcoRoute AI

A demo AI chat workspace with a local-first Privacy Shield and a
pluggable, OpenAI-compatible AI backend.

## Stages implemented

- **Stage 1** — Frontend foundation (login, chat workspace, Impact Dashboard, Settings shell).
- **Stage 2** — Real, browser-side Privacy Shield (email/phone/PAN/Aadhaar/credit-card detection + redaction, confidential-term extraction from uploaded TXT/CSV files).
- **Stage 3** — Real AI API integration via a small Node/Express backend, speaking to any OpenAI-compatible endpoint (e.g. Unsloth Studio).

## Project layout

```
ecoroute-ai/
├── src/                  # React + Vite frontend
│   ├── services/
│   │   ├── privacyService.js   # local detection/redaction (Stage 2)
│   │   └── aiService.js        # talks to our own backend only (Stage 3)
│   └── components/
└── server/               # Node + Express backend (Stage 3)
    └── src/
        ├── providers/openaiCompatible.js
        ├── config.js            # in-memory config store
        └── index.js
```

## Running it

### 1. Backend

```
cd server
npm install
npm start        # listens on http://localhost:8787 by default
```

Optional `.env` (see `server/.env.example`):

```
PORT=8787
```

No AI provider API key goes in an env file — it's entered through the
app's Settings panel and held in the server's memory only, for the life
of the process. Restarting the server clears it.

### 2. Frontend

```
npm install
npm run dev       # http://localhost:5173
```

Optional `.env` for the frontend if your backend isn't on the default port:

```
VITE_API_BASE_URL=http://localhost:8787
```

### 3. Connect a provider

In the app, open **Settings** and fill in:
- **Provider**: Custom OpenAI-compatible API (fixed for this stage)
- **API base URL**: e.g. your Unsloth Studio host, ending before `/v1`
- **API key**
- **Model ID**

Click **Test connection** to verify, then **Save configuration**. The
key is sent once to the local backend over `POST /api/config` and kept
in memory there — never written to localStorage, never logged, never
committed to source.

## Privacy Shield guarantee (Stage 2 + 3)

- Every outgoing chat message is run through `privacyService.redactText()`
  in the browser *before* it is stored or sent to the backend.
- The backend (`/api/chat`) only ever receives already-redacted text.
- Uploaded "Company security notes" files are read and parsed entirely
  in the browser; their contents are never sent to the backend or to
  any AI provider — only the extracted confidential *terms* feed the
  redaction step.

## Backend API

- `POST /api/config` — `{ baseUrl, apiKey, modelId }` → stores config in memory, returns a key-free summary.
- `GET /api/config` — returns `{ configured, provider, baseUrl, modelId }` (no key).
- `POST /api/test-connection` — `{ baseUrl, apiKey, modelId }` (or falls back to saved config) → `{ ok, error? }`.
- `POST /api/chat` — `{ messages: [{ role, content }] }` (already redacted) → `{ reply }`.

Errors (invalid key, unknown model, unreachable host, timeout) are
returned as `{ error }` with an appropriate status code instead of
throwing, so the UI can show them without crashing.

## Tests

```
# frontend
npm test

# backend
cd server && npm test
```

## Not yet implemented (future stages)

- Token Simplifier
- Model Router
- Real cost/energy/CO₂ accounting on the Impact Dashboard
