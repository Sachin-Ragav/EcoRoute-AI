import express from 'express'
import cors from 'cors'
import {
  listProfiles,
  getProfileInternal,
  getDefaultProfileInternal,
  upsertProfile,
  deleteProfile,
  setDefaultProfile,
} from './profileStore.js'
import { testConnection, chat } from './providers/openaiCompatible.js'
import { evaluateEthics } from '../../src/services/ethicsPolicy.js'
import { checkCompanyPolicy } from '../../src/services/companyPolicyService.js'
import { getCompanyPolicy, getCompanyPolicySummary, saveCompanyPolicy, updateCompanyPolicyRules, removeCompanyPolicy } from './companyPolicyStore.js'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

const PORT = process.env.PORT || 8787

function toProviderConfig(profile) {
  return { baseUrl: profile.baseUrl, apiKey: profile.apiKey, modelId: profile.modelId }
}

// ---- Multi-profile management -------------------------------------
// Never returns apiKey (listProfiles/upsertProfile already strip it).

app.get('/api/profiles', (_req, res) => {
  res.json({ profiles: listProfiles() })
})

app.post('/api/profiles', (req, res) => {
  try {
    const profile = upsertProfile(req.body || {})
    res.json({ profile })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.put('/api/profiles/:id', (req, res) => {
  if (!getProfileInternal(req.params.id)) {
    return res.status(404).json({ error: 'Profile not found.' })
  }
  try {
    const profile = upsertProfile({ ...req.body, id: req.params.id })
    res.json({ profile })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.delete('/api/profiles/:id', (req, res) => {
  const ok = deleteProfile(req.params.id)
  if (!ok) return res.status(404).json({ error: 'Profile not found.' })
  res.json({ ok: true })
})

app.post('/api/profiles/:id/default', (req, res) => {
  const profile = setDefaultProfile(req.params.id)
  if (!profile) return res.status(404).json({ error: 'Profile not found.' })
  res.json({ profile })
})

app.post('/api/profiles/:id/test', async (req, res) => {
  const profile = getProfileInternal(req.params.id)
  if (!profile) return res.status(404).json({ error: 'Profile not found.' })
  const result = await testConnection(toProviderConfig(profile))
  res.status(result.ok ? 200 : 502).json(result)
})

// ---- Company policy guard ------------------------------------------
app.get('/api/company-policy', (_req, res) => res.json({ policy: getCompanyPolicySummary() }))
app.post('/api/company-policy', (req, res) => {
  try { res.json({ policy: getCompanyPolicySummary(saveCompanyPolicy(req.body || {})) }) } catch (err) { res.status(400).json({ error: err.message }) }
})
app.put('/api/company-policy/rules', (req, res) => {
  try { res.json({ policy: getCompanyPolicySummary(updateCompanyPolicyRules(req.body?.rules)) }) } catch (err) { res.status(400).json({ error: err.message }) }
})
app.delete('/api/company-policy', (_req, res) => { removeCompanyPolicy(); res.json({ ok: true }) })

// ---- Legacy single-config endpoints (kept for backward compatibility
// with existing Settings UI / aiService calls). They operate on the
// default profile, creating one named "Default" on first save.
app.post('/api/config', (req, res) => {
  const { baseUrl, apiKey, modelId } = req.body || {}
  if (!baseUrl || !apiKey || !modelId) {
    return res.status(400).json({ error: 'baseUrl, apiKey, and modelId are all required.' })
  }
  const existingDefault = getDefaultProfileInternal()
  try {
    const profile = upsertProfile({
      id: existingDefault?.id,
      name: existingDefault?.name || 'Default',
      provider: 'custom-openai-compatible',
      baseUrl,
      apiKey,
      modelId,
      isDefault: true,
      capabilities: existingDefault?.capabilities || [],
    })
    res.json({ configured: true, provider: profile.provider, baseUrl: profile.baseUrl, modelId: profile.modelId })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

app.get('/api/config', (_req, res) => {
  const profile = getDefaultProfileInternal()
  if (!profile) return res.json({ configured: false })
  res.json({ configured: true, provider: profile.provider, baseUrl: profile.baseUrl, modelId: profile.modelId })
})

// ---- Connection test: an ad-hoc config, a specific profile id, or the
// default profile.
app.post('/api/test-connection', async (req, res) => {
  const { baseUrl, apiKey, modelId, profileId } = req.body || {}
  let config = null
  if (baseUrl && apiKey && modelId) {
    config = { baseUrl, apiKey, modelId }
  } else if (profileId) {
    const profile = getProfileInternal(profileId)
    if (!profile) return res.status(404).json({ ok: false, error: 'Profile not found.' })
    config = toProviderConfig(profile)
  } else {
    const profile = getDefaultProfileInternal()
    config = profile ? toProviderConfig(profile) : null
  }

  if (!config) {
    return res.status(400).json({ ok: false, error: 'No configuration provided or saved yet.' })
  }

  const result = await testConnection(config)
  res.status(result.ok ? 200 : 502).json(result)
})

// ---- Chat: resolves the profile server-side from a trusted id. The
// frontend never supplies a base URL or API key here — only a profile
// id selected by the Model Router (or chosen manually by the user).
app.post('/api/chat', async (req, res) => {
  const { messages, profileId } = req.body || {}
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages must be a non-empty array.' })
  }

  // Defense in depth: the browser checks before calling this endpoint, but
  // the backend never trusts that decision. Only inspect message text and
  // never log it; blocked content is rejected before profile/provider work.
  const latestUserMessage = [...messages].reverse().find((message) => message?.role === 'user')
  const latestContent = latestUserMessage?.content || ''
  const ethicsDecision = evaluateEthics(latestContent)
  if (ethicsDecision.level === 'BLOCKED' || ethicsDecision.level === 'RESTRICTED') {
    return res.status(400).json({ error: `Request blocked by EcoRoute AI policy: ${ethicsDecision.explanation}`, policy: { level: ethicsDecision.level, category: ethicsDecision.category, alternative: ethicsDecision.alternative } })
  }
  // Backend independently reloads the company policy. The client cannot bypass
  // this check by changing local state or omitting its decision.
  const companyPolicy = getCompanyPolicy()
  const companyDecision = checkCompanyPolicy(latestContent, companyPolicy?.rules || [])
  if (companyDecision.level === 'BLOCKED' || companyDecision.level === 'RESTRICTED') {
    return res.status(400).json({ error: 'Request blocked by the configured company privacy policy.', policy: { level: companyDecision.level, violations: companyDecision.violations.map(({ category, sourceSection, explanation, alternative }) => ({ category, sourceSection, explanation, alternative })) } })
  }

  let profile = null
  let usedFallback = false

  if (profileId) {
    profile = getProfileInternal(profileId)
    if (profile && !profile.enabled) profile = null
    if (!profile) {
      // Selected profile is gone/disabled — fall back to the default,
      // and tell the client that happened.
      profile = getDefaultProfileInternal()
      usedFallback = true
    }
  } else {
    profile = getDefaultProfileInternal()
  }

  if (!profile) {
    return res.status(400).json({ error: 'No AI provider is configured yet. Add a model in Settings first.' })
  }

  // NOTE: messages here are expected to already be redacted by the
  // browser's Privacy Shield (and optionally simplified) before this
  // endpoint is ever called.
  const result = await chat(toProviderConfig(profile), messages)
  if (!result.ok) {
    return res.status(result.status || 502).json({ error: result.error })
  }
  res.json({
    reply: result.reply,
    usedProfileId: profile.id,
    usedModelId: profile.modelId,
    fallback: usedFallback,
  })
})

const server = app.listen(PORT, () => {
  // Intentionally no config/key details in this log line.
  console.log(`EcoRoute AI server listening on port ${PORT}`)
})

// Make sure Node's own socket timeout can't cancel a slow provider
// response before our 600s (10 min) provider timeout has a chance to fire.
server.requestTimeout = 605000
server.headersTimeout = 606000

export default app
