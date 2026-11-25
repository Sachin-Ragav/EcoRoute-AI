// Vite emits this same-version PDF.js worker as a standalone module asset.
// Keeping the import here lets attachmentService use a relative new URL in
// the browser without loading the worker during Node/Vitest tests.
import 'pdfjs-dist/legacy/build/pdf.worker.min.mjs'
