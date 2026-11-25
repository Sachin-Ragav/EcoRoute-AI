import { useRef, useState } from 'react'
import { ArrowUp, Paperclip, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react'
import { ATTACHMENT_LIMITS, formatBytes, processAttachments } from '../services/attachmentService.js'
import { analyzeDocumentIntegrity } from '../services/documentIntegrityService.js'
import '../styles/MessageInput.css'

function MessageInput({ onSend, onIntegrityResult, disabled = false }) {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState([])
  const [processing, setProcessing] = useState(false)
  const [uploadError, setUploadError] = useState(null)
  const [attachmentConsent, setAttachmentConsent] = useState(false)
  const inputRef = useRef(null)

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!files.length) return
    if (attachments.length + files.length > ATTACHMENT_LIMITS.maxAttachments) {
      setUploadError(`Up to ${ATTACHMENT_LIMITS.maxAttachments} attachments are allowed per message.`)
      return
    }
    setProcessing(true)
    setUploadError(null)
    try {
      const results = await processAttachments(files)
      setAttachments((current) => [...current, ...results])
    } catch (error) {
      setUploadError(error.message)
    } finally {
      setProcessing(false)
    }
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    if (disabled || processing) return
    const trimmed = value.trim()
    if (!trimmed && attachments.length === 0) return
    if (attachments.length > 0 && !attachmentConsent) {
      setUploadError('Confirm that attachment content may be sent to your configured AI provider.')
      return
    }
    onSend(trimmed, attachments)
    setValue('')
    setAttachmentConsent(false)
    setAttachments([])
    setUploadError(null)
  }

  return <div className="composer-wrap">
    {attachments.length > 0 && <div className="attachment-list" aria-label="Attachments">
      {attachments.map((attachment) => <div className={`attachment-chip ${attachment.status === 'error' ? 'is-error' : ''}`} key={attachment.id}>
        {attachment.previewUrl ? <img src={attachment.previewUrl} alt="" /> : attachment.kind === 'image' ? <ImageIcon size={14} /> : <FileText size={14} />}
        <span className="attachment-chip-info"><strong title={attachment.name}>{attachment.name}</strong><small>{formatBytes(attachment.size)} · {attachment.status === 'ready' ? attachment.kind.toUpperCase() : attachment.error}</small>{attachment.status === 'ready' && attachment.kind === 'image' && <small className="attachment-note">Image preview only; provider image support is not configured.</small>}</span>
        {attachment.status === 'ready' && attachment.kind !== 'image' && <button type="button" className="integrity-button" onClick={() => onIntegrityResult?.(attachment, analyzeDocumentIntegrity(attachment))}>Analyze integrity</button>}
        <button type="button" aria-label={`Remove ${attachment.name}`} onClick={() => setAttachments((current) => current.filter((item) => item.id !== attachment.id))}><X size={14} /></button>
      </div>)}
    </div>}
    {uploadError && <p className="attachment-error">{uploadError}</p>}
    {attachments.length > 0 && <label className="attachment-consent"><input type="checkbox" checked={attachmentConsent} onChange={(event) => setAttachmentConsent(event.target.checked)} /> I consent to sending processed attachment content to the configured AI provider.</label>}
    <form className="message-input" onSubmit={handleSubmit}>
      <button type="button" className="attach-button" aria-label="Add attachments" title="Add attachments" disabled={disabled || processing} onClick={() => inputRef.current?.click()}>{processing ? <Loader2 size={16} className="spin" /> : <Paperclip size={16} />}<input ref={inputRef} type="file" multiple hidden accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.doc,.txt,.csv,.xlsx,.pptx,image/jpeg,image/png,image/webp,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.presentationml.presentation" onChange={handleFiles} /></button>
      <textarea rows={1} placeholder="Message EcoRoute AI..." value={value} disabled={disabled || processing} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) handleSubmit(e) }} />
      <button type="submit" disabled={disabled || processing || (!value.trim() && attachments.length === 0)} aria-label="Send message"><ArrowUp size={16} /></button>
    </form>
  </div>
}

export default MessageInput
