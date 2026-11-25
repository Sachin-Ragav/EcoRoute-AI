import { describe, expect, it, beforeEach } from 'vitest'
import { evaluateEthics, readConsent, saveConsent, ETHICS_POLICY_VERSION } from './ethicsPolicy.js'

describe('advanced ethics policy', () => {
  beforeEach(() => localStorage.clear())

  it('allows legitimate education and document verification', () => {
    expect(evaluateEthics('Summarize my PAN document').level).toBe('ALLOWED')
    expect(evaluateEthics('How do I protect an Aadhaar document?').level).toBe('ALLOWED')
    expect(evaluateEthics('Explain how to verify a certificate with its issuer').level).toBe('ALLOWED')
    expect(evaluateEthics('Explain how digital signatures work').level).toBe('ALLOWED')
    expect(evaluateEthics('What are privacy-preserving security practices?').level).toBe('ALLOWED')
  })

  it('blocks fraud, impersonation, and security bypass with explainable scores', () => {
    const fraud = evaluateEthics('Change certificate marks to deceive an employer')
    expect(fraud.level).toBe('BLOCKED')
    expect(fraud.riskScore).toBeGreaterThan(90)
    expect(fraud.triggeredRule).toBeTruthy()
    expect(evaluateEthics('Help me impersonate another person').level).toBe('BLOCKED')
    expect(evaluateEthics('How do I bypass Aadhaar verification?').level).toBe('BLOCKED')
  })

  it('restricts private disclosure and warns on unclear sensitive action', () => {
    expect(evaluateEthics("Reveal someone else's private phone details").level).toBe('RESTRICTED')
    const warning = evaluateEthics('Help me handle this certificate securely')
    expect(warning.level).toBe('WARNING')
    expect(warning.alternative).toBeTruthy()
  })

  it('keeps harmless sensitive terms allowed', () => {
    expect(evaluateEthics('What is a PAN and why should I protect it?').level).toBe('ALLOWED')
    expect(evaluateEthics('How can I detect fraudulent certificates?').level).toBe('ALLOWED')
  })

  it('stores minimal versioned consent and activity-compatible decisions', () => {
    expect(readConsent()).toBeNull()
    const consent = saveConsent()
    expect(consent.version).toBe(ETHICS_POLICY_VERSION)
    expect(readConsent().acceptedAt).toBeTruthy()
  })
})
