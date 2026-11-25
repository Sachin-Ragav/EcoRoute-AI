export const INTEGRITY_RISK = { LOW: 'LOW RISK', REVIEW: 'REVIEW REQUIRED', HIGH: 'HIGH RISK' }

function finding(code, severity, title, explanation) {
  return { code, severity, title, explanation }
}

function textSignals(text) {
  const findings = []
  const value = String(text || '')
  const documentContext = /\b(certificate|transcript|mark[- ]?sheet|result|diploma|official document|identity document)\b/i.test(value)
  const marksContext = /\b(mark|marks|grade|grades|score|scores|percentage|percent)\b/i.test(value)

  // Generic certificate terms, ordinary scores, names and dates are normal
  // document content and intentionally produce no finding.
  const explicitFraud = /\b(forged|fabricated|fraudulent|fake|counterfeit|doctored)\b/i.test(value)
  const explicitTampering = /\b(altered|tampered|manipulated|modified|doctored)\b/i.test(value)
  if ((explicitFraud || explicitTampering) && documentContext) {
    findings.push(finding(
      'EXPLICIT_ALTERATION_LANGUAGE',
      explicitFraud ? 'high' : 'review',
      explicitFraud ? 'Document uses explicit fraud language' : 'Document uses explicit alteration language',
      'The text explicitly describes a document as forged, fraudulent, altered, or tampered. This is a strong review indicator, not independent proof of tampering.',
    ))
  }

  // Only flag marks when the text describes a before/after or original/revised
  // change. A normal score such as “Marks: 98%” is not suspicious.
  const hasOriginalMarks = /\b(original|previous|old|before)\b[\s\S]{0,45}\b(mark|marks|grade|grades|score|scores|percentage|percent)\b/i.test(value)
  const hasRevisedMarks = /\b(revised|updated|new|after|changed|corrected|amended)\b[\s\S]{0,45}\b(mark|marks|grade|grades|score|scores|percentage|percent)\b/i.test(value)
  const hasNumericChange = /\b(?:from\s+\d{1,3}(?:\.\d+)?%?\s+to\s+\d{1,3}(?:\.\d+)?%?|\d{1,3}(?:\.\d+)?%?\s*(?:changed|revised|increased|decreased|改)\s*(?:to\s*)?\d{1,3}(?:\.\d+)?%?)\b/i.test(value)
  if (documentContext && marksContext && ((hasOriginalMarks && hasRevisedMarks) || hasNumericChange)) {
    findings.push(finding(
      'MARKS_CHANGE',
      explicitFraud || explicitTampering ? 'high' : 'review',
      'Original and revised marks appear in the document text',
      'The extracted text describes marks, grades, or scores as changed between values. Confirm the result directly with the issuing institution; extracted text cannot prove who made the change.',
    ))
  }

  // The same before/after signal applies to official dates or names, but a
  // single ordinary date or name remains harmless.
  const identityField = /\b(date|issue date|name|student name|holder name)\b/i
  const hasOriginalField = /\b(original|previous|old|before)\b[\s\S]{0,35}\b(date|name|issue date|student name|holder name)\b/i.test(value)
  const hasRevisedField = /\b(revised|updated|new|after|changed|corrected|amended)\b[\s\S]{0,35}\b(date|name|issue date|student name|holder name)\b/i.test(value)
  if (documentContext && identityField.test(value) && hasOriginalField && hasRevisedField) {
    findings.push(finding('OFFICIAL_FIELD_CHANGE', explicitFraud ? 'high' : 'review', 'An official date or name is described as changed', 'The text describes a before/after change to an official field. Verify against issuer records; this is not proof of tampering.'))
  }

  return findings
}

function analyzeMetadata(attachment) {
  const findings = []
  const info = attachment.metadata?.info || {}
  const created = String(info.CreationDate || '')
  const modified = String(info.ModDate || '')
  // Metadata is advisory only. Ignore producer/application names and do not
  // elevate a normal metadata field into a fraud decision.
  if (created && modified && /^D:\d{4}/.test(created) && /^D:\d{4}/.test(modified)) {
    const createdYear = Number(created.slice(2, 6))
    const modifiedYear = Number(modified.slice(2, 6))
    if (modifiedYear < createdYear) findings.push(finding('METADATA_DATE_ORDER', 'info', 'Metadata dates are unusual', 'The modification year precedes the creation year. Metadata can be edited or normalized and is only an advisory indicator.'))
  }
  return findings
}

export function verifyPdfSignature(attachment) {
  if (!attachment?.signatureMarker) return { status: 'UNSIGNED', explanation: 'No PDF signature structure was detected.' }
  return { status: 'UNVERIFIABLE', explanation: 'A PDF signature structure was detected, but this browser implementation does not perform cryptographic CMS certificate-chain verification.' }
}

function riskFromFindings(findings) {
  if (findings.some((item) => item.severity === 'high')) return INTEGRITY_RISK.HIGH
  if (findings.some((item) => item.severity === 'review')) return INTEGRITY_RISK.REVIEW
  return INTEGRITY_RISK.LOW
}

export function analyzeDocumentIntegrity(attachment) {
  if (!attachment || attachment.status !== 'ready') {
    return { riskLevel: INTEGRITY_RISK.REVIEW, findings: [finding('UNAVAILABLE', 'review', 'Document could not be analyzed', 'Process the file successfully before running integrity analysis.')], signature: { status: 'UNVERIFIABLE', explanation: 'No verified document bytes are available.' }, limitations: ['No conclusion can be drawn from an unavailable document.'] }
  }
  const findings = [...textSignals(attachment.extractedText || ''), ...analyzeMetadata(attachment)]
  if (attachment.kind === 'pdf') {
    const signature = verifyPdfSignature(attachment)
    if (signature.status === 'UNVERIFIABLE') findings.push(finding('SIGNATURE_UNVERIFIED', 'review', 'Digital signature could not be verified', signature.explanation))
    return { riskLevel: riskFromFindings(findings), findings, signature, documentType: 'PDF', limitations: ['Heuristics identify indicators only; they do not prove a document is genuine or fraudulent.', 'Issuer, government database, and certificate-chain verification are not available in this phase.'] }
  }
  return { riskLevel: riskFromFindings(findings), findings, signature: { status: 'NOT_APPLICABLE', explanation: 'Cryptographic signature verification is currently implemented only as PDF structure detection.' }, documentType: attachment.kind?.toUpperCase(), limitations: ['Font, alignment, layout, image and metadata heuristics are not proof of tampering.', 'No external issuer verification is performed.', 'Visual image analysis and OCR are not implemented.'] }
}

export async function analyzePdfBytes(buffer) {
  const { extractPdfText } = await import('./attachmentService.js')
  const extracted = await extractPdfText(buffer)
  return { text: extracted.text, pageCount: extracted.pageCount }
}
