export const ETHICS_POLICY_VERSION = '1.0'
export const ETHICS_POLICY_UPDATED = '2026-11-23'

export const POLICY_CATEGORIES = {
  PRIVACY: 'Privacy and confidential information',
  FRAUD: 'Fraudulent documents or credentials',
  IMPERSONATION: 'Identity theft or impersonation',
  SECURITY: 'Bypassing security or privacy protections',
  HARM: 'Harmful or deceptive use',
}

const POLICY_SECTION = 'AI Ethics & Acceptable Use Agreement'
const safeContext = /\b(prevent|prevention|protect|protection|verify|verification|detect|report|educat|learn|explain|lawful|legitimate|defensive|awareness|ethics|privacy[- ]preserving|authorized|own|my own)\w*\b/i
const directAction = /\b(help|show|give|write|create|make|generate|change|alter|edit|modify|find|reveal|expose|publish|share|bypass|impersonat|forge|fake|steal|dox)\w*\b/i
const sensitiveSubject = /\b(certificate|marks?|grades?|scores?|pan|aadhaar|passport|license|identity|personal|private|confidential|signature|account|security|authentication)\b/i
const suspiciousDocumentAction = /\b(change|alter|edit|modify|increase|decrease|replace|remove|forge|fake|fabricat|manipulat|doctor)\w*\b[\s\S]{0,80}\b(mark|grade|score|certificate|diploma|degree|pan|aadhaar|passport|license|document|credential|signature)\b/i
const explicitForgery = /\b(forge|forged|forgery|fake|fabricat|counterfeit|fraudulent|deceptive credential)\w*\b/i
const impersonation = /\b(impersonat|pretend to be|pose as|masquerad|steal|take over|hijack)\w*\b[\s\S]{0,45}\b(identity|account|profile|name|person)\b/i
const securityBypass = /\b(bypass|circumvent|evade|disable|defeat|break into|get around)\w*\b[\s\S]{0,60}\b(security|privacy|authentication|verification|access control|2fa|password|encryption|kyc|aadhaar|pan)\b/i
const privateDisclosure = /\b(expose|publish|leak|dox|share|reveal|dump|find|get|lookup|obtain)\w*\b[\s\S]{0,70}\b(someone else|another person|someone else's|their|private|personal|confidential)\b[\s\S]{0,70}\b(data|information|details|address|phone|email|id|records|identity)\b/i
const harmfulDeception = /\b(trick|deceive|manipulat|scam|defraud|blackmail|threaten)\w*\b/i

function decision(level, category = null, explanation = null, alternative = null, rule = null, score = 0) {
  return {
    allowed: level === 'ALLOWED' || level === 'WARNING',
    level,
    category,
    riskScore: score,
    explanation,
    triggeredRule: rule,
    alternative,
    policySection: level === 'ALLOWED' ? null : POLICY_SECTION,
  }
}

export function evaluateEthics(text = '') {
  const value = String(text || '').trim()
  if (!value) return decision('ALLOWED')

  if (suspiciousDocumentAction.test(value) || (explicitForgery.test(value) && sensitiveSubject.test(value))) {
    const malicious = /\b(forge|forgery|fraudulent|counterfeit|steal|deceive|scam|defraud)\w*\b/i.test(value)
    return decision(
      malicious ? 'BLOCKED' : 'RESTRICTED',
      POLICY_CATEGORIES.FRAUD,
      malicious ? 'The request asks for forgery, fraud, or deceptive alteration.' : 'The request appears to ask for changing sensitive document content.',
      malicious ? 'Ask for legitimate document verification or how to correct an official record through its issuer.' : 'Ask for a comparison checklist or an official correction process.',
      'FRAUDULENT_DOCUMENT_ACTION',
      malicious ? 95 : 78,
    )
  }
  if (impersonation.test(value)) return decision('BLOCKED', POLICY_CATEGORIES.IMPERSONATION, 'The request appears to involve identity theft, impersonation, or unauthorized account use.', 'Ask for consent-based communication, identity protection, or official account recovery guidance.', 'IDENTITY_IMPERSONATION', 95)
  if (securityBypass.test(value)) return decision('BLOCKED', POLICY_CATEGORIES.SECURITY, 'The request asks to bypass a security, privacy, authentication, or verification control.', 'Ask about the official recovery, consent, or defensive security-review process.', 'SECURITY_BYPASS', 92)
  if (privateDisclosure.test(value)) return decision('RESTRICTED', POLICY_CATEGORIES.PRIVACY, 'The request may expose another person’s private or confidential information.', 'Remove identifying content and ask for privacy-preserving, consent-based guidance.', 'UNAUTHORIZED_PRIVATE_DISCLOSURE', 72)
  if (harmfulDeception.test(value) && !safeContext.test(value)) return decision('BLOCKED', POLICY_CATEGORIES.HARM, 'The request appears intended to deceive, defraud, threaten, or harm another person.', 'Ask for prevention, reporting, safety, or conflict-resolution guidance.', 'HARMFUL_DECEPTION', 88)
  if (directAction.test(value) && sensitiveSubject.test(value) && !safeContext.test(value)) return decision('WARNING', POLICY_CATEGORIES.PRIVACY, 'The request involves sensitive documents, identity, privacy, or security content without clear protective context.', 'Confirm authorization and remove unnecessary identifying information before continuing.', 'SENSITIVE_CONTEXT_UNCLEAR', 42)
  return decision('ALLOWED')
}

export function explainEthicsDecision(text) { return evaluateEthics(text) }

export function readConsent() {
  try {
    const raw = localStorage.getItem('ecoroute-ethics-consent')
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveConsent(version = ETHICS_POLICY_VERSION) {
  const consent = { version, acceptedAt: new Date().toISOString(), scope: 'local-installation-demo' }
  localStorage.setItem('ecoroute-ethics-consent', JSON.stringify(consent))
  return consent
}

export function recordEthicsDecision(policyDecision) {
  try {
    const existing = JSON.parse(localStorage.getItem('ecoroute-ethics-activity') || '[]')
    const event = {
      level: policyDecision.level,
      category: policyDecision.category || 'None',
      explanation: policyDecision.explanation || null,
      timestamp: new Date().toISOString(),
    }
    localStorage.setItem('ecoroute-ethics-activity', JSON.stringify([event, ...existing].slice(0, 50)))
    return event
  } catch {
    return null
  }
}

export function readEthicsActivity() {
  try {
    const value = JSON.parse(localStorage.getItem('ecoroute-ethics-activity') || '[]')
    return Array.isArray(value) ? value : []
  } catch {
    return []
  }
}
