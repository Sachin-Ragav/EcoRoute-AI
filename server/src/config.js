// In-memory only. This is a single-process prototype: configuration
// lives here for the life of the server process and is never written
// to disk, a database, or any log line. Restarting the server clears it.

let currentConfig = null

export function setConfig({ provider, baseUrl, apiKey, modelId }) {
  currentConfig = {
    provider: provider || 'custom-openai-compatible',
    baseUrl: (baseUrl || '').replace(/\/+$/, ''),
    apiKey,
    modelId,
  }
  return getPublicConfig()
}

export function getConfig() {
  return currentConfig
}

// Safe to log/return to the client: never includes the API key.
export function getPublicConfig() {
  if (!currentConfig) return { configured: false }
  const { provider, baseUrl, modelId } = currentConfig
  return { configured: true, provider, baseUrl, modelId }
}
