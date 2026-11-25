// Persists AI model profiles (provider + base URL + API key + model id)
// to a local JSON file so configuration survives server restarts.
// API keys never leave this module in plain form via the public getters
// used by routes — only resolveInternal()/getDefaultInternal(), used
// server-side to actually call a provider, include the key.

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.MODEL_PROFILES_DIR || path.join(__dirname, '..', 'data')
// Overridable so tests can point at a throwaway file instead of the
// real user configuration store.
const STORE_FILE = process.env.MODEL_PROFILES_FILE || path.join(DATA_DIR, 'model-profiles.json')

const VALID_CAPABILITIES = ['fast', 'general', 'coding', 'reasoning', 'summarization']

function ensureStore() {
  // STORE_FILE may be overridden (for example in tests or custom installs),
  // so create its actual parent directory rather than always creating DATA_DIR.
  const storeDir = path.dirname(STORE_FILE)
  if (!fs.existsSync(storeDir)) {
    fs.mkdirSync(storeDir, { recursive: true, mode: 0o700 })
  }
  if (!fs.existsSync(STORE_FILE)) {
    fs.writeFileSync(STORE_FILE, JSON.stringify({ profiles: [] }, null, 2), { mode: 0o600 })
  }
}

function readAll() {
  ensureStore()
  try {
    const raw = fs.readFileSync(STORE_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.profiles) ? parsed.profiles : []
  } catch {
    return []
  }
}

function writeAll(profiles) {
  ensureStore()
  fs.writeFileSync(STORE_FILE, JSON.stringify({ profiles }, null, 2), { mode: 0o600 })
}

function sanitizeCapabilities(capabilities) {
  if (!Array.isArray(capabilities)) return []
  return [...new Set(capabilities.filter((c) => VALID_CAPABILITIES.includes(c)))]
}

function toPublic(profile) {
  const { id, name, provider, baseUrl, modelId, enabled, isDefault, capabilities } = profile
  return { id, name, provider, baseUrl, modelId, enabled, isDefault, capabilities }
}

export function listProfiles() {
  return readAll().map(toPublic)
}

// Internal use only (server -> provider calls). Includes the API key.
export function getProfileInternal(id) {
  return readAll().find((p) => p.id === id) || null
}

export function getDefaultProfileInternal() {
  const profiles = readAll()
  const explicit = profiles.find((p) => p.isDefault && p.enabled)
  if (explicit) return explicit
  return profiles.find((p) => p.enabled) || null
}

function genId() {
  return `p_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Create or update a profile. Pass an existing `id` to update.
 * Required fields for a new profile: name, baseUrl, apiKey, modelId.
 * apiKey is optional on update (omit to keep the previously stored key).
 */
export function upsertProfile(input) {
  const profiles = readAll()
  const {
    id,
    name,
    provider = 'custom-openai-compatible',
    baseUrl,
    apiKey,
    modelId,
    enabled = true,
    isDefault = false,
    capabilities = [],
  } = input || {}

  const existingIndex = id ? profiles.findIndex((p) => p.id === id) : -1
  const existing = existingIndex >= 0 ? profiles[existingIndex] : null

  if (!existing && (!name || !baseUrl || !apiKey || !modelId)) {
    throw new Error('name, baseUrl, apiKey, and modelId are required to create a profile.')
  }

  const next = {
    id: existing ? existing.id : genId(),
    name: name ?? existing.name,
    provider: provider ?? existing?.provider ?? 'custom-openai-compatible',
    baseUrl: (baseUrl ?? existing?.baseUrl ?? '').replace(/\/+$/, ''),
    apiKey: apiKey || existing?.apiKey,
    modelId: modelId ?? existing?.modelId,
    enabled: enabled ?? existing?.enabled ?? true,
    isDefault: Boolean(isDefault ?? existing?.isDefault ?? false),
    capabilities: sanitizeCapabilities(capabilities ?? existing?.capabilities ?? []),
  }

  if (next.isDefault) {
    for (const p of profiles) p.isDefault = false
  }

  if (existingIndex >= 0) {
    profiles[existingIndex] = next
  } else {
    // First profile ever created becomes the default automatically.
    if (profiles.length === 0) next.isDefault = true
    profiles.push(next)
  }

  writeAll(profiles)
  return toPublic(next)
}

export function deleteProfile(id) {
  const profiles = readAll()
  const next = profiles.filter((p) => p.id !== id)
  if (next.length === profiles.length) return false
  // If we deleted the default, promote the first remaining enabled one.
  if (!next.some((p) => p.isDefault) && next.length > 0) {
    const promoted = next.find((p) => p.enabled) || next[0]
    promoted.isDefault = true
  }
  writeAll(next)
  return true
}

export function setDefaultProfile(id) {
  const profiles = readAll()
  const target = profiles.find((p) => p.id === id)
  if (!target) return null
  for (const p of profiles) p.isDefault = p.id === id
  writeAll(profiles)
  return toPublic(target)
}

export const CAPABILITIES = VALID_CAPABILITIES
