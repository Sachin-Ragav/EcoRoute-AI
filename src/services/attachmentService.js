// Vite turns this exact pdfjs-dist worker version into a deployable asset.
// Vitest transforms the ?url import; browser code uses the emitted URL.
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

const MAX_FILE_SIZE = 10 * 1024 * 1024
const MAX_ATTACHMENTS = 5

export const ATTACHMENT_LIMITS = { maxFileSize: MAX_FILE_SIZE, maxAttachments: MAX_ATTACHMENTS }
export const ATTACHMENT_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/webp'],
  pdf: ['application/pdf'],
  document: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword', 'text/plain'],
  spreadsheet: ['text/csv', 'application/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  presentation: ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
}
const EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'pdf', 'docx', 'doc', 'txt', 'csv', 'xlsx', 'pptx'])

export function sanitizeFilename(name = 'attachment') {
  const clean = String(name).replace(/[\\/\0\r\n]/g, '_').replace(/[^a-zA-Z0-9._() -]/g, '_').trim()
  return (clean || 'attachment').slice(0, 160)
}

function extension(name) { return String(name).toLowerCase().split('.').pop() }
function textDecoder() { return new TextDecoder('utf-8', { fatal: false }) }

function hasPrefix(bytes, prefix) { return prefix.every((value, index) => bytes[index] === value) }
function isZip(bytes) { return hasPrefix(bytes, [0x50, 0x4b, 0x03, 0x04]) || hasPrefix(bytes, [0x50, 0x4b, 0x05, 0x06]) }

export function detectFileKind(file, bytes) {
  const ext = extension(file.name)
  if (!EXTENSIONS.has(ext)) return { ok: false, error: 'Unsupported file type.' }
  if (ext === 'jpg' || ext === 'jpeg') return hasPrefix(bytes, [0xff, 0xd8, 0xff]) ? { ok: true, kind: 'image' } : { ok: false, error: 'This file is not a valid JPEG.' }
  if (ext === 'png') return hasPrefix(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ? { ok: true, kind: 'image' } : { ok: false, error: 'This file is not a valid PNG.' }
  if (ext === 'webp') return textDecoder().decode(bytes.slice(0, 12)).startsWith('RIFF') && textDecoder().decode(bytes.slice(8, 12)) === 'WEBP' ? { ok: true, kind: 'image' } : { ok: false, error: 'This file is not a valid WEBP.' }
  if (ext === 'pdf') return textDecoder().decode(bytes.slice(0, 5)) === '%PDF-' ? { ok: true, kind: 'pdf' } : { ok: false, error: 'This file is not a valid PDF.' }
  if (['docx', 'xlsx', 'pptx'].includes(ext)) return isZip(bytes) ? { ok: true, kind: ext } : { ok: false, error: `This file is not a valid ${ext.toUpperCase()} package.` }
  if (ext === 'doc') return { ok: false, error: 'Legacy .DOC files are not supported in this browser-only processor. Save as DOCX or TXT.' }
  if (ext === 'txt' || ext === 'csv') return { ok: true, kind: ext }
  return { ok: false, error: 'Unsupported file type.' }
}

function decodeXml(value) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim()
}

async function inflate(bytes) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Compressed document extraction is unavailable in this browser.')
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function unzip(buffer) {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const files = {}
  let offset = 0
  while (offset + 30 <= bytes.length) {
    if (view.getUint32(offset, true) !== 0x04034b50) break
    const method = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = textDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength))
    const dataStart = offset + 30 + nameLength + extraLength
    const raw = bytes.slice(dataStart, dataStart + compressedSize)
    if (method === 0) files[name] = textDecoder().decode(raw)
    else if (method === 8) files[name] = textDecoder().decode(await inflate(raw))
    else throw new Error(`Unsupported compression in ${sanitizeFilename(name)}.`)
    offset = dataStart + compressedSize
  }
  return files
}

async function extractOfficeText(buffer, kind) {
  const files = await unzip(buffer)
  let names = []
  if (kind === 'docx') names = ['word/document.xml']
  if (kind === 'pptx') names = Object.keys(files).filter((name) => /^ppt\/slides\/slide\d+\.xml$/i.test(name)).sort()
  if (kind === 'xlsx') names = ['xl/sharedStrings.xml', ...Object.keys(files).filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/i.test(name)).sort()]
  const content = names.map((name) => files[name] ? decodeXml(files[name]) : '').filter(Boolean).join('\n')
  if (!content) throw new Error('The document contains no extractable text.')
  return content.slice(0, 250000)
}

function clonePdfBytes(value) {
  // `instanceof ArrayBuffer` is not reliable across jsdom/browser realms.
  // Normalize by byte length and copy every input so PDF.js can transfer its
  // own buffer without detaching the caller's bytes.
  if (value && Object.prototype.toString.call(value) === '[object ArrayBuffer]') return value.slice(0)
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer
  }
  throw new TypeError('PDF data must be an ArrayBuffer or typed array.')
}

async function loadPdfDocument(value) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const inBrowser = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof Worker !== 'undefined'
  // PDF.js may transfer its input buffer to the worker. Always provide a
  // fresh clone so callers can safely reuse the original for metadata,
  // signature inspection, repeated uploads, or another attachment.
  const data = new Uint8Array(clonePdfBytes(value))
  if (inBrowser) {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    return pdfjs.getDocument({ data }).promise
  }
  return pdfjs.getDocument({ data, disableWorker: true }).promise
}

export async function extractPdfText(value) {
  // PDF.js handles compressed streams, escaped strings, fonts, and multi-page
  // documents. OCR is deliberately not claimed here: scanned pages still need
  // a future OCR provider or local OCR engine.
  let pdf
  try {
    pdf = await loadPdfDocument(value)
  } catch (error) {
    throw new Error(`Could not parse PDF: ${error?.message || 'invalid PDF structure.'}`)
  }
  const pages = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    const text = content.items.map((item) => item.str || '').join(' ').replace(/\s+/g, ' ').trim()
    if (text) pages.push(`Page ${pageNumber}: ${text}`)
  }
  if (!pages.length) throw new Error('This PDF has no selectable text. Scanned-page OCR is not available in this browser-only processor.')
  return { text: pages.join('\n'), pageCount: pdf.numPages }
}

async function extractPdfMetadata(value) {
  try {
    const pdf = await loadPdfDocument(value)
    const metadata = await pdf.getMetadata()
    return { info: metadata?.info || {}, metadata: metadata?.metadata?.getAll?.() || null, pageCount: pdf.numPages }
  } catch {
    return { info: {}, metadata: null, pageCount: null }
  }
}

function hasPdfSignatureMarker(value) {
  const source = textDecoder().decode(new Uint8Array(value))
  return /\/ByteRange\b|\/Type\s*\/Sig\b|\/SubFilter\s*\/adbe\./.test(source)
}

export async function processAttachment(file, onProgress) {
  const name = sanitizeFilename(file?.name)
  if (!file || file.size > MAX_FILE_SIZE) return { id: crypto.randomUUID(), name, size: file?.size || 0, status: 'error', error: `File exceeds the ${MAX_FILE_SIZE / 1024 / 1024} MB limit.` }
  onProgress?.(10)
  const buffer = await file.arrayBuffer()
  const detected = detectFileKind(file, new Uint8Array(buffer))
  if (!detected.ok) return { id: crypto.randomUUID(), name, size: file.size, status: 'error', error: detected.error }
  const id = crypto.randomUUID()
  const previewUrl = detected.kind === 'image' && typeof URL !== 'undefined' ? URL.createObjectURL(file) : null
  try {
    onProgress?.(40)
    let extractedText = ''
    let pageCount = null
    let signatureMarker = false
    let metadata = null
    if (detected.kind === 'txt' || detected.kind === 'csv') extractedText = textDecoder().decode(new Uint8Array(buffer)).slice(0, 250000)
    else if (detected.kind === 'pdf') {
      const extracted = await extractPdfText(buffer)
      extractedText = extracted.text.slice(0, 250000)
      pageCount = extracted.pageCount
      // Use the original file bytes only for local inspection. PDF.js gets
      // independent clones and may transfer its own copy to a worker.
      signatureMarker = hasPdfSignatureMarker(buffer)
      metadata = await extractPdfMetadata(buffer)
    } else if (['docx', 'xlsx', 'pptx'].includes(detected.kind)) extractedText = await extractOfficeText(buffer, detected.kind)
    if (detected.kind === 'image') return { id, name, size: file.size, kind: detected.kind, mimeType: file.type, previewUrl, extractedText: '', status: 'ready', imageAnalysisAvailable: false, progress: 100 }
    onProgress?.(100)
    return { id, name, size: file.size, kind: detected.kind, mimeType: file.type, extractedText, pageCount, signatureMarker, metadata, status: 'ready', progress: 100 }
  } catch (error) {
    return { id, name, size: file.size, kind: detected.kind, previewUrl, status: 'error', error: error.message || 'Could not extract file content.' }
  }
}

export async function processAttachments(files, onProgress) {
  if (files.length > MAX_ATTACHMENTS) throw new Error(`You can attach up to ${MAX_ATTACHMENTS} files per message.`)
  const results = []
  for (const [index, file] of files.entries()) results.push(await processAttachment(file, (progress) => onProgress?.(index, progress)))
  return results
}

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}
