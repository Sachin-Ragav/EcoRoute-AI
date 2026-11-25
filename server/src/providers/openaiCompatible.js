// Reusable adapter for any OpenAI-compatible /v1/chat/completions API
// (Unsloth Studio and others). Never logs the API key or message content.

// Chat generation against a local model can be slow — allow up to 10
// minutes before giving up. The connection test below stays short (60s).
const DEFAULT_TIMEOUT_MS = 600000

function withTimeout(ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

function buildHeaders(apiKey) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`
  return headers
}

/**
 * Normalizes fetch/HTTP failures into a consistent { ok, error, status } shape
 * instead of throwing, so routes can respond cleanly.
 */
async function requestChatCompletions({ baseUrl, apiKey, modelId }, messages, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  if (!baseUrl || !modelId) {
    return { ok: false, status: 400, error: 'Missing base URL or model ID.' }
  }

  const url = `${baseUrl}/v1/chat/completions`
  const { signal, clear } = withTimeout(timeoutMs)

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({ model: modelId, messages }),
      signal,
    })
    clear()

    if (res.status === 401 || res.status === 403) {
      return { ok: false, status: res.status, error: 'Invalid or unauthorized API key.' }
    }
    if (res.status === 404) {
      return { ok: false, status: res.status, error: 'Model not found or unavailable.' }
    }
    if (!res.ok) {
      const bodyText = await res.text().catch(() => '')
      return { ok: false, status: res.status, error: `Provider error (${res.status}): ${bodyText.slice(0, 200)}` }
    }

    const data = await res.json()
    const reply = data?.choices?.[0]?.message?.content
    if (typeof reply !== 'string') {
      return { ok: false, status: 502, error: 'Unexpected response shape from provider.' }
    }
    return { ok: true, reply, raw: data }
  } catch (err) {
    clear()
    if (err?.name === 'AbortError') {
      return { ok: false, status: 504, error: 'Connection to the AI provider timed out.' }
    }
    return { ok: false, status: 502, error: 'Could not connect to the AI provider.' }
  }
}

/**
 * Lightweight connectivity/auth check: sends a minimal chat request and
 * treats any non-network, non-auth response as "reachable".
 */
export async function testConnection(config) {
  const result = await requestChatCompletions(
    config,
    [{ role: 'user', content: 'ping' }],
    { timeoutMs: 60000 },
  )
  if (result.ok) return { ok: true }
  return { ok: false, status: result.status, error: result.error }
}

export async function chat(config, messages) {
  return requestChatCompletions(config, messages)
}
