import { describe, expect, it } from 'vitest'
import { extractPdfText } from './attachmentService.js'

// Two-page selectable-text fixture with compressed PDF streams is generated
// during the test so the diagnostic does not depend on a checked-in document.
function makeTwoPagePdf() {
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 6 0 R >>endobj',
    '4 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>endobj',
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
    '6 0 obj<< /Length 39 >>stream\nBT /F1 12 Tf 20 100 Td (First page text) Tj ET\nendstream endobj',
    '7 0 obj<< /Length 40 >>stream\nBT /F1 12 Tf 20 100 Td (Second page text) Tj ET\nendstream endobj',
  ]
  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const object of objects) { offsets.push(pdf.length); pdf += `${object}\n` }
  const xref = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new TextEncoder().encode(pdf).buffer
}

describe('PDF.js diagnostic extraction', () => {
  it('extracts text from both pages and returns the page count', async () => {
    const bytes = makeTwoPagePdf()
    const result = await extractPdfText(bytes)
    expect(result.pageCount).toBe(2)
    expect(result.text).toContain('First page text')
    expect(result.text).toContain('Second page text')
  })

  it('can load the same PDF bytes repeatedly without detachment', async () => {
    const bytes = makeTwoPagePdf()
    const first = await extractPdfText(bytes)
    const second = await extractPdfText(bytes)
    expect(first.pageCount).toBe(2)
    expect(second.text).toContain('Second page text')
  })

  it('accepts multiple independent PDF byte buffers', async () => {
    const first = await extractPdfText(makeTwoPagePdf())
    const second = await extractPdfText(makeTwoPagePdf())
    expect(first.pageCount).toBe(second.pageCount)
  })

  it('reports scanned PDFs without selectable text clearly', async () => {
    const scanned = '%PDF-1.4\\n1 0 obj<< /Type /Catalog >>endobj\\n%%EOF'
    await expect(extractPdfText(new TextEncoder().encode(scanned).buffer)).rejects.toThrow(/OCR|selectable text|parse PDF/i)
  })
})
