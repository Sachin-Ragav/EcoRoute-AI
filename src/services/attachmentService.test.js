import { describe, expect, it } from 'vitest'
import { detectFileKind, formatBytes, sanitizeFilename, extractPdfText } from './attachmentService.js'

describe('attachment service', () => {
  it('sanitizes path traversal and unsafe filename characters', () => {
    expect(sanitizeFilename('../secret\\file?.pdf')).toBe('.._secret_file_.pdf')
  })

  it('validates signatures for images, PDFs, and zip-based office files', () => {
    expect(detectFileKind({ name: 'photo.png' }, new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])).kind).toBe('image')
    expect(detectFileKind({ name: 'report.pdf' }, new TextEncoder().encode('%PDF-1.7')).kind).toBe('pdf')
    expect(detectFileKind({ name: 'report.docx' }, new Uint8Array([80, 75, 3, 4])).kind).toBe('docx')
    expect(detectFileKind({ name: 'photo.png' }, new TextEncoder().encode('not an image')).ok).toBe(false)
  })

  it('rejects legacy DOC content as unsupported', () => {
    expect(detectFileKind({ name: 'old.doc' }, new Uint8Array([208, 207, 17, 224])).error).toMatch(/not supported/i)
  })

  it('formats byte sizes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })
})
