// Smart Model Router: classifies a prompt into a category and picks the
// best configured, enabled profile for it. Pure and local — no network
// calls, no AI model. Operates only on profiles the user has configured
// and explicitly assigned capabilities to; never invents capabilities.

export const CATEGORIES = ['SIMPLE', 'GENERAL', 'CODING', 'REASONING', 'SUMMARIZATION']

// A category maps to the capability tag a user can assign to a profile
// in Settings. Keep 1:1 and explicit — no guessing.
const CATEGORY_TO_CAPABILITY = {
  SIMPLE: 'fast',
  GENERAL: 'general',
  CODING: 'coding',
  REASONING: 'reasoning',
  SUMMARIZATION: 'summarization',
}

const CODING_HINTS = /```|\bfunction\b|\bdef \b|\bclass \b|\bconst \b|\blet \b|\bimport \b|\bexport \b|\bstack trace\b|\btraceback\b|\bnull pointer\b|\bcompile(r)?\b|\bdebug(ging)?\b|\bexception\b|\bregex\b|\bapi\b|\bsql\b|\bfix (this|my) (code|bug)\b|\brefactor\b/i
const REASONING_HINTS = /\bprove\b|\banalyz(e|is)\b|\bcompare and contrast\b|\btrade-?offs?\b|\bstep by step\b|\bmulti-?step\b|\bwhy (does|is|would)\b|\boptimi[sz]e\b|\bcalculate\b|\bderive\b|\bequation\b|\balgorithm\b|\bproof\b|\d+\s*[\+\-\*\/]\s*\d+/i
const SUMMARIZATION_HINTS = /\bsummari[sz]e\b|\btl;?dr\b|\bshorten\b|\bkey points?\b|\bmain takeaways?\b|\bcondense\b|\bbrief(ly)? (explain|describe)\b|\bextract (the )?(key|main) (points?|information)\b/i
const SIMPLE_HINTS = /^\s*(hi|hello|hey|yo|thanks|thank you|good (morning|evening|afternoon))[.!,\s]*$/i

/**
 * Deterministic, keyword/pattern-based classification. No ML, no AI
 * call — same input always yields the same category.
 */
export function classifyPrompt(text) {
  const prompt = (text || '').trim()

  if (!prompt || SIMPLE_HINTS.test(prompt) || prompt.length < 12) {
    return 'SIMPLE'
  }
  if (CODING_HINTS.test(prompt)) return 'CODING'
  if (SUMMARIZATION_HINTS.test(prompt)) return 'SUMMARIZATION'
  if (REASONING_HINTS.test(prompt)) return 'REASONING'
  return 'GENERAL'
}

function enabledProfiles(profiles) {
  return (profiles || []).filter((p) => p.enabled)
}

function getDefault(profiles) {
  const enabled = enabledProfiles(profiles)
  return enabled.find((p) => p.isDefault) || enabled[0] || null
}

/**
 * Selects the best enabled profile for `category`.
 *
 * profiles: array of public profile objects { id, modelId, enabled,
 *   isDefault, capabilities: string[] }
 * manualProfileId: if set and that profile is enabled, it always wins
 *   (explicit user override).
 *
 * Returns { category, selectedProfileId, selectedModelId, reason,
 *   confidence } or null selection fields if nothing is configured.
 */
export function selectModel({ category, profiles = [], manualProfileId = null }) {
  const resolvedCategory = CATEGORIES.includes(category) ? category : 'GENERAL'

  if (manualProfileId) {
    const manual = profiles.find((p) => p.id === manualProfileId && p.enabled)
    if (manual) {
      return {
        category: resolvedCategory,
        selectedProfileId: manual.id,
        selectedModelId: manual.modelId,
        reason: `Manual override: user selected "${manual.name}".`,
        confidence: 1,
      }
    }
    // Requested override is disabled/missing — fall through to auto
    // routing rather than silently using an unavailable model.
  }

  const capability = CATEGORY_TO_CAPABILITY[resolvedCategory]
  const specialized = enabledProfiles(profiles).find((p) => (p.capabilities || []).includes(capability))
  if (specialized) {
    return {
      category: resolvedCategory,
      selectedProfileId: specialized.id,
      selectedModelId: specialized.modelId,
      reason: `Routed to "${specialized.name}" — assigned "${capability}" capability for ${resolvedCategory} prompts.`,
      confidence: 0.9,
    }
  }

  const fallback = getDefault(profiles)
  if (fallback) {
    return {
      category: resolvedCategory,
      selectedProfileId: fallback.id,
      selectedModelId: fallback.modelId,
      reason: `No profile assigned the "${capability}" capability — used the default enabled model "${fallback.name}".`,
      confidence: 0.5,
    }
  }

  return {
    category: resolvedCategory,
    selectedProfileId: null,
    selectedModelId: null,
    reason: 'No enabled model profiles are configured.',
    confidence: 0,
  }
}

/**
 * Convenience: classify + select in one call.
 */
export function routePrompt({ text, profiles = [], manualProfileId = null }) {
  const category = classifyPrompt(text)
  return selectModel({ category, profiles, manualProfileId })
}
