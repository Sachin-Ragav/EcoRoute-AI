// Talks only to our own backend (never directly to the AI provider from
// the browser). The backend holds the API key in memory server-side.
// Callers must pass already-redacted message content — this module does
// not redact anything itself.

import { simplifyPrompt } from './tokenSimplifierService.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8787'

// Re-exported so callers of aiService can simplify a prompt before
// sending it, without depending on tokenSimplifierService directly.
// Purely local — does not call sendChatMessage or any provider.
export { simplifyPrompt }

async function parseJsonSafe(res) {
  try {
    return await res.json()
  } catch {
    return {}
  }
}

export async function saveConfig({ baseUrl, apiKey, modelId }) {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl, apiKey, modelId }),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not save configuration.')
  return data
}

// Returns the backend's public (API-key-free) configuration, e.g.
// { configured, provider, baseUrl, modelId }, so the UI can restore
// previously saved values (like Model ID) without ever seeing the key.
export async function getConfig() {
  const res = await fetch(`${API_BASE}/api/config`)
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not load configuration.')
  return data
}

export async function testConnection({ baseUrl, apiKey, modelId, profileId }) {
  const res = await fetch(`${API_BASE}/api/test-connection`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ baseUrl, apiKey, modelId, profileId }),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Connection test failed.')
  }
  return data
}

/**
 * messages: array of { role, text } already redacted (and optionally
 * simplified) by the caller. profileId: optional — the model profile
 * chosen by the Model Router or manually by the user. The backend
 * resolves the profile (and its API key) itself; no key or base URL is
 * ever sent from here.
 */
export async function sendChatMessage(messages, profileId = null) {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.text })),
      profileId,
    }),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'The AI provider request failed.')
  return data
}

// ---- Multi-profile model management --------------------------------
// All of these only ever receive/return public profile fields; the API
// key never leaves the backend.

export async function listProfiles() {
  const res = await fetch(`${API_BASE}/api/profiles`)
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not load model profiles.')
  return data.profiles || []
}

export async function saveProfile(profile) {
  const url = profile.id ? `${API_BASE}/api/profiles/${profile.id}` : `${API_BASE}/api/profiles`
  const res = await fetch(url, {
    method: profile.id ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not save model profile.')
  return data.profile
}

export async function deleteProfile(id) {
  const res = await fetch(`${API_BASE}/api/profiles/${id}`, { method: 'DELETE' })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not delete model profile.')
  return true
}

export async function setDefaultProfile(id) {
  const res = await fetch(`${API_BASE}/api/profiles/${id}/default`, { method: 'POST' })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not set default model profile.')
  return data.profile
}

export async function getCompanyPolicy() {
  const res = await fetch(`${API_BASE}/api/company-policy`)
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not load company policy.')
  return data.policy || null
}

export async function saveCompanyPolicy(policy) {
  const res = await fetch(`${API_BASE}/api/company-policy`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(policy) })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not save company policy.')
  return data.policy
}

export async function updateCompanyPolicyRules(rules) {
  const res = await fetch(`${API_BASE}/api/company-policy/rules`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rules }) })
  const data = await parseJsonSafe(res)
  if (!res.ok) throw new Error(data.error || 'Could not update company policy rules.')
  return data.policy
}

export async function removeCompanyPolicy() {
  const res = await fetch(`${API_BASE}/api/company-policy`, { method: 'DELETE' })
  if (!res.ok) throw new Error('Could not remove company policy.')
  return true
}

export async function testProfileConnection(id) {
  const res = await fetch(`${API_BASE}/api/profiles/${id}/test`, { method: 'POST' })
  const data = await parseJsonSafe(res)
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || 'Connection test failed.')
  }
  return data
}
