# Smart Model Router

## What it does
Lets you configure multiple AI model profiles (local Unsloth Studio or any
OpenAI-compatible endpoint) and automatically routes each prompt to the
best one, based on a deterministic, local classification of the prompt.
No prompt text or capability guess is ever sent to an external service to
decide routing — classification runs in the browser.

## Configuring models (Settings → Model Management)
1. Open Settings → Model Management.
2. Fill in Display name, API base URL, API key, Model ID.
3. Check any capabilities this model is good at: `fast`, `general`,
   `coding`, `reasoning`, `summarization`. These are **assigned by you** —
   the router never infers or invents a model's abilities.
4. Click "Add profile". Repeat for more models.
5. Use the profile list to enable/disable, set a default, edit, delete,
   or test a connection.
6. Under "Smart Model Router", toggle Automatic routing on/off, and
   optionally pick a Manual model override (always wins over automatic
   routing when set).

Profiles persist in `server/data/model-profiles.json` (directory mode
`700`, file mode `600`) so they survive a backend restart. API keys never
leave that file/the backend process — the frontend only ever sees
`{ id, name, provider, baseUrl, modelId, enabled, isDefault, capabilities }`.

## How routing works
1. User sends a prompt.
2. **Privacy Shield** redacts sensitive data (unchanged from before).
3. **Token Simplifier** optionally shrinks the redacted text (unchanged
   from before).
4. **Model Router** (`src/services/modelRouterService.js`):
   - `classifyPrompt(text)` — deterministic pattern matching into
     `SIMPLE | GENERAL | CODING | REASONING | SUMMARIZATION`.
   - `selectModel({ category, profiles, manualProfileId })`:
     - A manual override, if enabled and still valid, always wins.
     - Otherwise, picks an enabled profile whose assigned capability
       matches the category (`fast`→SIMPLE, `general`→GENERAL,
       `coding`→CODING, `reasoning`→REASONING,
       `summarization`→SUMMARIZATION).
     - If none matches, falls back to the default enabled profile.
     - If nothing is configured/enabled, returns no selection and the
       UI shows a clear "No enabled model is available" message.
5. The browser sends only a `profileId` (never a base URL or API key) to
   `POST /api/chat`. The backend resolves the real profile (with its key)
   itself from `server/src/profileStore.js` and calls the existing
   OpenAI-compatible adapter (`server/src/providers/openaiCompatible.js`,
   unchanged, still with the 10-minute chat timeout / 60s test timeout).
6. If the requested profile was deleted or disabled between selection and
   the request landing, the backend silently resolves to the default
   profile before making any provider call (no duplicate network request)
   and reports `fallback: true`, shown in the chat UI and Impact
   Dashboard. If the provider call itself fails (e.g. invalid key,
   network error), the error is shown directly — it is not retried
   against a different model, to avoid duplicate/ambiguous calls.

## Analytics
Each request's real, measured outcome — category, selected model,
reason, duration, success/failure, estimated input tokens, and tokens
saved by the Token Simplifier — is reported to the Impact Dashboard. No
cost, energy, or CO₂ figures are shown, since there is no reliable way to
measure them for a local/self-hosted model; the dashboard says
"Not available" instead of fabricating numbers.

## Known limitations
- Classification is keyword/pattern based, not ML — edge-case prompts may
  land in `GENERAL` by default (safe but not "smart").
- Only one provider adapter (OpenAI-compatible) exists; the profile
  `provider` field is reserved for future adapters.
- No automated end-to-end HTTP test of the Express routes themselves yet
  (the underlying `profileStore` and provider adapter are unit-tested,
  and a manual smoke test confirmed the routes work).
- A failed provider call is not automatically retried on another model.
