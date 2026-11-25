// Local, deterministic prompt simplifier. Runs entirely in-browser:
// no network calls, no AI model/provider involved. Independent of
// aiService.js and privacyService.js — callers (e.g. aiService) may use
// this before or after privacy redaction, but this module never touches
// Privacy Shield's logic.
//
// Strategy: carve out "protected" structured spans (code fences, inline
// code, JSON-looking blocks, quoted text, URLs) first and never touch
// their contents. Only the remaining plain-text spans get conservative,
// reversible-in-meaning cleanup (whitespace collapsing + filler-word /
// redundant-phrase removal from a small fixed list). If the result does
// not actually shrink, the original is returned unchanged.

// Order matters: code fences before inline code/URLs/JSON so a fence's
// body isn't re-split by the other patterns.
const PROTECTED_PATTERNS = [
  /```[\s\S]*?```/g, // fenced code blocks
  /`[^`\n]+`/g, // inline code
  /"[^"\n]*"/g, // double-quoted text
  /'[^'\n]*'/g, // single-quoted text
  /https?:\/\/\S+/g, // URLs
  /\{[\s\S]*?\}/g, // JSON-ish object literals (brace-delimited)
  /\[[\s\S]*?\]/g, // JSON-ish array literals (bracket-delimited)
]

// Conservative filler words/phrases: only removed when they add nothing
// to meaning. Kept intentionally small to avoid altering intent.
const FILLER_PHRASES = [
  'just to let you know',
  'i was wondering if',
  'please note that',
  'kind of',
  'sort of',
  'really',
  'actually',
  'basically',
  'simply',
  'very',
  'quite',
  'in order to',
  'at this point in time',
  'due to the fact that',
  'as a matter of fact',
  'for all intents and purposes',
]

// Redundant doubled phrasing -> single word (meaning-preserving).
const REDUNDANT_PHRASES = [
  [/\beach and every\b/gi, 'each'],
  [/\bfirst and foremost\b/gi, 'first'],
  [/\bvarious different\b/gi, 'various'],
  [/\bend result\b/gi, 'result'],
  [/\bfuture plans\b/gi, 'plans'],
  [/\bpast history\b/gi, 'history'],
  [/\babsolutely essential\b/gi, 'essential'],
  [/\btrue facts\b/gi, 'facts'],
  [/\bcompletely finish(ed)?\b/gi, 'finish$1'],
]

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits text into alternating { protected: false, text } and
 * { protected: true, text } segments, so protected spans are never
 * rewritten below.
 */
function splitProtectedSegments(text) {
  const matches = []
  for (const pattern of PROTECTED_PATTERNS) {
    pattern.lastIndex = 0
    let m
    while ((m = pattern.exec(text)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length })
      if (m[0].length === 0) pattern.lastIndex++
    }
  }
  // Merge overlapping/adjacent matches, earliest-first, longest-wins.
  matches.sort((a, b) => a.start - b.start || b.end - a.end)
  const merged = []
  for (const m of matches) {
    const last = merged[merged.length - 1]
    if (last && m.start < last.end) {
      last.end = Math.max(last.end, m.end)
    } else {
      merged.push({ ...m })
    }
  }

  const segments = []
  let cursor = 0
  for (const { start, end } of merged) {
    if (start > cursor) segments.push({ protected: false, text: text.slice(cursor, start) })
    segments.push({ protected: true, text: text.slice(start, end) })
    cursor = end
  }
  if (cursor < text.length) segments.push({ protected: false, text: text.slice(cursor) })
  return segments
}

/**
 * Conservative, deterministic cleanup of a single plain-text segment.
 * Never applied to protected segments.
 */
function simplifyPlainText(text) {
  let out = text

  // Redundant doubled phrasing first (word-boundary based, safe).
  for (const [pattern, replacement] of REDUNDANT_PHRASES) {
    out = out.replace(pattern, replacement)
  }

  // Filler phrases: remove as whole words/phrases only, case-insensitive,
  // word-boundary guarded so we never chew into unrelated words.
  for (const phrase of FILLER_PHRASES) {
    const re = new RegExp(`\\b${escapeRegExp(phrase)}\\b[,]?\\s*`, 'gi')
    out = out.replace(re, '')
  }

  // Collapse runs of whitespace (but keep paragraph breaks as a single
  // newline) and trim.
  out = out
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/ +\n/g, '\n')
    .replace(/^[ \t]+|[ \t]+$/gm, '')
    .trim()

  return out
}

/**
 * Rough, model-agnostic token estimate (~4 chars/token, the common
 * heuristic for English text). Always an estimate unless a real
 * tokenizer for the selected model is wired in later.
 */
function estimateTokens(text) {
  if (!text) return 0
  return Math.max(1, Math.ceil(text.length / 4))
}

/**
 * Produces a conservative, deterministic, local simplification of
 * `originalPrompt`. Never mutates the input string. Structured content
 * (code blocks/inline code, quoted text, URLs, JSON-like objects/arrays)
 * is left byte-for-byte untouched.
 *
 * Returns:
 *   {
 *     original: string,
 *     optimized: string,
 *     originalTokens: number,   // estimate
 *     optimizedTokens: number,  // estimate
 *     tokensSaved: number,
 *     percentSaved: number,     // 0-100, rounded to 1 decimal
 *     isEstimate: true,
 *     changed: boolean,
 *   }
 */
export function simplifyPrompt(originalPrompt) {
  const original = originalPrompt ?? ''

  if (typeof original !== 'string' || original.trim() === '') {
    const tokens = estimateTokens(original)
    return {
      original,
      optimized: original,
      originalTokens: tokens,
      optimizedTokens: tokens,
      tokensSaved: 0,
      percentSaved: 0,
      isEstimate: true,
      changed: false,
    }
  }

  const segments = splitProtectedSegments(original)
  const rebuilt = segments
    .map((seg) => (seg.protected ? seg.text : simplifyPlainText(seg.text)))
    .join('')

  const originalTokens = estimateTokens(original)
  const candidateTokens = estimateTokens(rebuilt)

  // Requirement 10: if it doesn't safely/actually reduce size, keep the
  // original unchanged.
  const safeToUse = rebuilt.trim() !== '' && candidateTokens < originalTokens
  const optimized = safeToUse ? rebuilt : original
  const optimizedTokens = safeToUse ? candidateTokens : originalTokens

  const tokensSaved = originalTokens - optimizedTokens
  const percentSaved = originalTokens > 0 ? Math.round((tokensSaved / originalTokens) * 1000) / 10 : 0

  return {
    original,
    optimized,
    originalTokens,
    optimizedTokens,
    tokensSaved,
    percentSaved,
    isEstimate: true,
    changed: safeToUse && optimized !== original,
  }
}
