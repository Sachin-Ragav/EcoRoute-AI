// All detection and redaction here runs entirely in the browser.
// Nothing in this file makes a network request, and original values are
// only ever returned to the caller in memory — never written to
// localStorage or any storage layer.

const SUPPORTED_EXTENSIONS = ['.txt', '.csv']

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Splits one CSV line into cells, respecting double-quoted cells that
 * may contain commas (and escaped "" quotes inside them).
 */
function parseCsvLine(line) {
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        cur += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  cells.push(cur)
  return cells
}

// Priority order matters: it decides which category "wins" when two
// patterns could both match the same span of text (e.g. a 12-digit
// Aadhaar-like number inside a longer digit run).
const BUILT_IN_PATTERNS = [
  {
    category: 'EMAIL',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9-]+\.[a-zA-Z]{2,}/g,
  },
  {
    category: 'CREDIT_CARD',
    // 13-19 digits, optionally grouped with spaces or dashes.
    regex: /\b(?:\d[ -]?){12,18}\d\b/g,
  },
  {
    category: 'AADHAAR',
    // 12 digits, optionally grouped in 4s (XXXX XXXX XXXX).
    regex: /\b\d{4}[ ]?\d{4}[ ]?\d{4}\b/g,
  },
  {
    category: 'PAN',
    // Indian PAN: 5 letters, 4 digits, 1 letter.
    regex: /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g,
  },
  {
    category: 'PHONE',
    // Deliberately narrow shapes only, to cut false positives on plain
    // short digit runs (order numbers, quantities, etc.):
    // +country code forms, parenthesised area codes, dash/space-grouped
    // 10-digit numbers, and bare 10-digit numbers.
    regex:
      /\+\d{1,3}[-.\s]\d{2,4}[-.\s]?\d{3,4}[-.\s]?\d{0,4}|\(\d{2,4}\)[-.\s]?\d{3,4}[-.\s]?\d{3,4}|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b|\b\d{5}[-.\s]\d{5}\b|\b\d{10}\b/g,
  },
]

/**
 * Finds all raw regex matches for one pattern in text.
 */
function findMatches(regex, text) {
  const matches = []
  let m
  const re = new RegExp(regex) // fresh instance, avoids lastIndex bugs
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex++
      continue
    }
    matches.push({ start: m.index, end: m.index + m[0].length, value: m[0] })
  }
  return matches
}

/**
 * Finds all occurrences of each confidential term (case-insensitive,
 * longest terms first so a longer phrase is matched before a shorter
 * substring of it).
 */
function findConfidentialMatches(text, confidentialTerms) {
  const terms = [...new Set(confidentialTerms.map((t) => t.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length,
  )

  const matches = []
  for (const term of terms) {
    const regex = new RegExp(escapeRegExp(term), 'gi')
    let m
    while ((m = regex.exec(text)) !== null) {
      if (m[0].length === 0) {
        regex.lastIndex++
        continue
      }
      matches.push({ start: m.index, end: m.index + m[0].length, value: m[0] })
    }
  }
  return matches
}

/**
 * Takes original text plus a list of confidential terms (extracted from
 * uploaded files) and returns redacted text, counts, and per-item detail.
 * Original values are only present in the returned object, in memory.
 */
export function redactText(text, confidentialTerms = []) {
  if (!text) {
    return {
      redactedText: '',
      totalDetections: 0,
      categories: {},
      detections: [],
    }
  }

  const categorized = [
    { category: 'CONFIDENTIAL', matches: findConfidentialMatches(text, confidentialTerms) },
    ...BUILT_IN_PATTERNS.map(({ category, regex }) => ({
      category,
      matches: findMatches(regex, text),
    })),
  ]

  // Accept matches in priority order, skipping anything that overlaps
  // a span already accepted by a higher-priority category.
  const accepted = []
  for (const { category, matches } of categorized) {
    const sorted = [...matches].sort((a, b) => a.start - b.start)
    for (const match of sorted) {
      const overlaps = accepted.some((a) => match.start < a.end && match.end > a.start)
      if (!overlaps) {
        accepted.push({ ...match, category })
      }
    }
  }

  accepted.sort((a, b) => a.start - b.start)

  const categoryCounters = {}
  const detections = []
  let redactedText = ''
  let cursor = 0

  for (const match of accepted) {
    categoryCounters[match.category] = (categoryCounters[match.category] || 0) + 1
    const placeholder = `[${match.category}_${categoryCounters[match.category]}]`

    redactedText += text.slice(cursor, match.start) + placeholder
    cursor = match.end

    detections.push({
      category: match.category,
      placeholder,
      original: match.value, // kept only in this in-memory return value
    })
  }
  redactedText += text.slice(cursor)

  return {
    redactedText,
    totalDetections: detections.length,
    categories: categoryCounters,
    detections,
  }
}

/**
 * Reads a File object as text using FileReader (browser-only).
 */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsText(file)
  })
}

/**
 * Extracts confidential phrases from an uploaded TXT or CSV file's text
 * content. Every non-empty line (TXT) or non-empty cell (CSV) is treated
 * as a protected phrase. Duplicate phrases (case-insensitive) are merged.
 */
export function extractConfidentialTerms(text, fileName = '') {
  const isCsv = fileName.toLowerCase().endsWith('.csv')
  const rawTerms = []

  if (isCsv) {
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      if (!line.trim()) continue
      const cells = parseCsvLine(line)
      for (const cell of cells) {
        const value = cell.trim()
        if (value) rawTerms.push(value)
      }
    }
  } else {
    const lines = text.split(/\r?\n/)
    for (const line of lines) {
      const value = line.trim()
      if (value) rawTerms.push(value)
    }
  }

  const seen = new Set()
  const terms = []
  for (const term of rawTerms) {
    const key = term.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      terms.push(term)
    }
  }
  return terms
}

export function isSupportedFile(file) {
  const name = file?.name?.toLowerCase() || ''
  return SUPPORTED_EXTENSIONS.some((ext) => name.endsWith(ext))
}

/**
 * Reads an uploaded file and extracts confidential terms from it.
 * Returns an error instead of throwing for unsupported or unreadable files.
 */
export async function processUploadedFile(file) {
  if (!isSupportedFile(file)) {
    return {
      name: file?.name || 'unknown file',
      terms: [],
      error: 'Unsupported file type. Only .txt and .csv files are supported.',
    }
  }

  try {
    const text = await readFileAsText(file)
    const terms = extractConfidentialTerms(text, file.name)
    return { name: file.name, terms, error: null }
  } catch {
    return { name: file.name, terms: [], error: 'Could not read this file.' }
  }
}
