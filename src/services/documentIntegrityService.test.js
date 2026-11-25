import { describe, expect, it } from 'vitest'
import { analyzeDocumentIntegrity, verifyPdfSignature, INTEGRITY_RISK } from './documentIntegrityService.js'

function textAttachment(extractedText) {
  return { status: 'ready', kind: 'txt', extractedText, metadata: { info: {} } }
}

describe('document integrity service', () => {
  it('classifies an ordinary clean certificate as low risk', () => {
    const result = analyzeDocumentIntegrity(textAttachment('Educational certificate\nName: A Student\nDate of birth: 2001-01-01\nMarks: 98%\nResult: Pass'))
    expect(result.riskLevel).toBe(INTEGRITY_RISK.LOW)
    expect(result.findings).toHaveLength(0)
  })

  it('detects original and revised marks as review required', () => {
    const result = analyzeDocumentIntegrity(textAttachment('Academic certificate\nOriginal marks: 68%\nRevised marks: 98%'))
    expect(result.riskLevel).toBe(INTEGRITY_RISK.REVIEW)
    expect(result.findings.some((item) => item.code === 'MARKS_CHANGE')).toBe(true)
  })

  it('detects explicit suspicious alteration wording', () => {
    const result = analyzeDocumentIntegrity(textAttachment('Academic certificate - altered and tampered copy'))
    expect(result.riskLevel).toBe(INTEGRITY_RISK.REVIEW)
    expect(result.findings.some((item) => item.code === 'EXPLICIT_ALTERATION_LANGUAGE')).toBe(true)
  })

  it('does not treat a normal date, name, score, or producer as tampering', () => {
    const result = analyzeDocumentIntegrity({ ...textAttachment('Certificate\nName: A Student\nIssue date: 2025-01-01\nScore: 90%'), kind: 'pdf', signatureMarker: false, metadata: { info: { Producer: 'Microsoft Print to PDF' } } })
    expect(result.riskLevel).toBe(INTEGRITY_RISK.LOW)
  })

  it('distinguishes signature structure detection from cryptographic verification', () => {
    expect(verifyPdfSignature({ signatureMarker: false }).status).toBe('UNSIGNED')
    expect(verifyPdfSignature({ signatureMarker: true }).status).toBe('UNVERIFIABLE')
  })
})
