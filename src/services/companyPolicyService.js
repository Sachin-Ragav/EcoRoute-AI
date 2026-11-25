// Deterministic, conservative company-policy guard. It only extracts rules from
// explicit policy language and never sends the full policy to an AI provider.

const RESTRICTION_SIGNAL = /\b(must not|may not|do not|don't|prohibited|forbidden|restricted|never|not share|not disclose|not upload|not transmit|external ai|third[- ]party ai|outside the company)\b/i

const RULE_PATTERNS = [
  { category: 'CONFIDENTIAL_INFORMATION', labels: ['confidential', 'proprietary', 'trade secret', 'non-public', 'internal only'], promptTerms: ['confidential', 'proprietary', 'trade secret', 'non-public', 'internal'] },
  { category: 'CUSTOMER_INFORMATION', labels: ['customer', 'client', 'consumer'], promptTerms: ['customer', 'client', 'consumer'] },
  { category: 'PERSONAL_DATA', labels: ['personal data', 'personally identifiable', 'pii', 'privacy'], promptTerms: ['personal data', 'personal information', 'pii', 'address', 'phone number', 'email'] },
  { category: 'EMPLOYEE_INFORMATION', labels: ['employee', 'staff', 'personnel', 'human resources', 'hr data'], promptTerms: ['employee', 'staff', 'personnel', 'hr data', 'salary'] },
  { category: 'FINANCIAL_BUSINESS_DATA', labels: ['financial', 'revenue', 'pricing', 'forecast', 'business plan', 'material non-public'], promptTerms: ['financial', 'revenue', 'pricing', 'forecast', 'business plan', 'material non-public'] },
  { category: 'EXTERNAL_AI_SHARING', labels: ['external ai', 'third-party ai', 'outside the company', 'external service', 'ai provider'], promptTerms: ['external ai', 'third-party ai', 'ai provider', 'outside the company', 'external service'] },
  { category: 'RETENTION_DISCLOSURE', labels: ['retain', 'retention', 'disclose', 'disclosure', 'transmit', 'export'], promptTerms: ['retain', 'retention', 'disclose', 'disclosure', 'transmit', 'export'] },
]

function splitClauses(text) {
  return String(text || '').split(/(?<=[.!?;\n])\s+/).map((clause) => clause.trim()).filter(Boolean)
}

function matchedLabels(clause, labels) {
  return labels.filter((label) => clause.toLowerCase().includes(label)).slice(0, 3)
}

export function extractCompanyPolicyRules(text = '') {
  const clauses = splitClauses(text)
  const rules = []
  for (const clause of clauses) {
    if (!RESTRICTION_SIGNAL.test(clause)) continue
    for (const pattern of RULE_PATTERNS) {
      const labels = matchedLabels(clause, pattern.labels)
      if (!labels.length) continue
      const source = clause.slice(0, 320)
      const id = `${pattern.category}-${rules.length + 1}`
      rules.push({
        id,
        category: pattern.category,
        enforcement: 'WARNING',
        summary: `Protect ${pattern.category.toLowerCase().replaceAll('_', ' ')} from unauthorized external sharing.`,
        keywords: pattern.promptTerms,
        sourceExcerpt: source,
        sourceSection: `Imported policy clause ${clauses.indexOf(clause) + 1}`,
        confidence: RESTRICTION_SIGNAL.test(clause) ? 'explicit' : 'review',
      })
    }
  }
  // Keep one strongest source clause per category; duplicates create noise and
  // make enforcement harder to understand.
  return rules.filter((rule, index, all) => all.findIndex((candidate) => candidate.category === rule.category) === index)
}

function hasAny(text, terms) {
  const lower = String(text || '').toLowerCase()
  return terms.some((term) => lower.includes(term))
}

export function checkCompanyPolicy(text = '', rules = []) {
  const sharingContext = /\b(share|send|upload|disclose|provide|paste|transmit|forward|external|provider|model|ai)\b/i.test(text)
  if (!sharingContext) return { allowed: true, level: 'ALLOWED', violations: [] }

  const violations = rules.filter((rule) => hasAny(text, rule.keywords || []))
    .map((rule) => ({
      ruleId: rule.id,
      category: rule.category,
      level: rule.enforcement || 'WARNING',
      explanation: rule.summary,
      sourceSection: rule.sourceSection,
      sourceExcerpt: rule.sourceExcerpt,
      confidence: rule.confidence || 'review',
      alternative: 'Remove the restricted content, redact it, or confirm an approved internal workflow before continuing.',
    }))

  const highest = violations.reduce((level, violation) => {
    const rank = { ALLOWED: 0, WARNING: 1, RESTRICTED: 2, BLOCKED: 3 }
    return rank[violation.level] > rank[level] ? violation.level : level
  }, 'ALLOWED')
  return { allowed: highest === 'ALLOWED' || highest === 'WARNING', level: highest, violations }
}

export function policySummary(policy) {
  if (!policy) return null
  return {
    id: policy.id,
    name: policy.name,
    companyName: policy.companyName || '',
    version: policy.version || 'Unversioned',
    uploadedAt: policy.uploadedAt,
    status: policy.status || 'active',
    ruleCount: policy.rules?.length || 0,
  }
}
