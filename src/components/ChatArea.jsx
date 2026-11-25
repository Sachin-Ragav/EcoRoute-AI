import { useState } from 'react'
import { Bot, User, Eye, EyeOff, Loader2, AlertTriangle, Gauge, ChevronDown, ChevronUp } from 'lucide-react'
import MessageInput from './MessageInput.jsx'
import PrivacyShieldBadge from './PrivacyShieldBadge.jsx'
import { redactText } from '../services/privacyService.js'
import { checkCompanyPolicy } from '../services/companyPolicyService.js'
import { sendChatMessage } from '../services/aiService.js'
import { simplifyPrompt } from '../services/tokenSimplifierService.js'
import { classifyPrompt, selectModel } from '../services/modelRouterService.js'
import { evaluateEthics, recordEthicsDecision } from '../services/ethicsPolicy.js'
import '../styles/ChatArea.css'

function ChatArea({
  messages = [],
  onMessagesChange,
  confidentialTerms = [],
  protectionActive = false,
  onRedaction,
  aiConfigured = false,
  modelId = '',
  profiles = [],
  routingEnabled = true,
  manualProfileId = null,
  onRouteResult,
  ethicsEnabled = true,
  companyPolicyRules = [],
  onNewChat,
}) {
  const [lastPreview, setLastPreview] = useState(null)
  const [showPreview, setShowPreview] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState(null)
  const [policyDecision, setPolicyDecision] = useState(null)

  // Token Simplifier: off by default so existing behavior (send the
  // redacted original, unchanged) is preserved until a user opts in.
  const [simplifierEnabled, setSimplifierEnabled] = useState(false)
  const [optimizerOpen, setOptimizerOpen] = useState(true)
  const [lastSimplification, setLastSimplification] = useState(null)
  const [lastRoute, setLastRoute] = useState(null)
  const [integrityResult, setIntegrityResult] = useState(null)

  const handleSend = async (text, attachments = []) => {
    if (isSending) return // prevent duplicate submissions

    const attachmentText = attachments.map((attachment) => {
      if (attachment.status !== 'ready') return `[Attachment unavailable: ${attachment.name}]`
      if (attachment.kind === 'image') return `[Image attachment: ${attachment.name}. Image understanding is unavailable for the configured provider.]`
      return `\n[Attachment: ${attachment.name}]\n${attachment.extractedText}\n[/Attachment]`
    }).join('\n')
    const promptWithAttachments = `${text}${attachmentText}`.trim()

    // Every message is checked locally before any backend/provider request.
    // Privacy Shield runs first, then the provider-independent ethics rules.
    const result = redactText(promptWithAttachments, confidentialTerms)
    const ethicsDecision = ethicsEnabled ? evaluateEthics(result.redactedText) : { allowed: true, level: 'ALLOWED' }
    if (ethicsDecision.level !== 'ALLOWED') {
      recordEthicsDecision(ethicsDecision)
      setError(null)
      setPolicyDecision(ethicsDecision)
      if (ethicsDecision.level === 'BLOCKED' || ethicsDecision.level === 'RESTRICTED') return
    } else {
      setPolicyDecision(null)
    }
    const companyDecision = checkCompanyPolicy(result.redactedText, companyPolicyRules)
    if (companyDecision.level !== 'ALLOWED') {
      setError(null)
      setPolicyDecision({
        level: companyDecision.level,
        category: 'Company policy guard',
        explanation: companyDecision.violations.map((item) => item.explanation).join(' '),
        triggeredRule: companyDecision.violations[0]?.category || 'Company rule',
        policySection: companyDecision.violations[0]?.sourceSection || 'Imported policy',
        alternative: companyDecision.violations[0]?.alternative || 'Redact or remove restricted content before sending.',
      })
      if (companyDecision.level === 'BLOCKED' || companyDecision.level === 'RESTRICTED') return
    }

    const userMessage = { id: `u${Date.now()}`, role: 'user', text: result.redactedText }
    const nextMessages = [...messages, userMessage]
    onMessagesChange(nextMessages)
    setLastPreview({ original: text, redactedText: result.redactedText, detections: result.detections })
    if (result.totalDetections > 0) setShowPreview(true)
    onRedaction?.(result.totalDetections)
    setError(null)

    // Simplification runs locally, only on the already-redacted text, so
    // sensitive data is never exposed to the simplifier or the provider.
    const simplification = simplifyPrompt(result.redactedText)
    setLastSimplification(simplification)

    if (!aiConfigured) {
      setError('No AI provider is configured yet. Add one in Settings to get live responses.')
      return
    }

    // History keeps the redacted text unchanged (for display and as
    // context for future turns). Only the outgoing copy of the latest
    // message is swapped to the optimized version when enabled.
    const outgoingText = simplifierEnabled && simplification.changed ? simplification.optimized : result.redactedText
    const outgoingMessages = [
      ...nextMessages.slice(0, -1),
      { ...userMessage, text: outgoingText },
    ]

    // Model Router: classification and selection are local and
    // deterministic, based only on profiles the user has configured —
    // no capability is ever invented. A manual override always wins; a
    // null selection just means "let the backend use its default".
    const category = classifyPrompt(result.redactedText)
    const route = manualProfileId
      ? selectModel({ category, profiles, manualProfileId })
      : routingEnabled
        ? selectModel({ category, profiles })
        : null
    setLastRoute(route)

    setIsSending(true)
    const startedAt = Date.now()
    try {
      const data = await sendChatMessage(outgoingMessages, route?.selectedProfileId || null)
      onMessagesChange([...nextMessages, { id: `a${Date.now()}`, role: 'assistant', text: data.reply }])
      onRouteResult?.({
        category: route?.category || null,
        profileId: data.usedProfileId || route?.selectedProfileId || null,
        modelId: data.usedModelId || route?.selectedModelId || null,
        reason: route?.reason || null,
        confidence: route?.confidence ?? null,
        fallback: Boolean(data.fallback),
        durationMs: Date.now() - startedAt,
        success: true,
        inputTokensEstimate: simplification.changed && simplifierEnabled ? simplification.optimizedTokens : simplification.originalTokens,
        tokensSavedBySimplifier: simplifierEnabled ? simplification.tokensSaved : 0,
      })
    } catch (err) {
      setError(err.message || 'The AI request failed.')
      onRouteResult?.({
        category: route?.category || null,
        profileId: route?.selectedProfileId || null,
        modelId: route?.selectedModelId || null,
        reason: route?.reason || null,
        confidence: route?.confidence ?? null,
        fallback: false,
        durationMs: Date.now() - startedAt,
        success: false,
        inputTokensEstimate: simplification.originalTokens,
        tokensSavedBySimplifier: simplifierEnabled ? simplification.tokensSaved : 0,
      })
    } finally {
      setIsSending(false)
    }
  }

  return (
    <main className="chat-area">
      <header className="chat-header">
        <div>
          <h1>Warehouse route optimization</h1>
          <span className="chat-header-model">
            {aiConfigured ? `Model: ${modelId}` : 'No model connected'}
          </span>
        </div>
        <div className="chat-header-actions">
          <button
            type="button"
            className={`token-simplifier-toggle ${simplifierEnabled ? 'is-on' : ''}`}
            onClick={() => setSimplifierEnabled((v) => !v)}
            aria-pressed={simplifierEnabled}
          >
            <Gauge size={13} />
            Token Simplifier: {simplifierEnabled ? 'On' : 'Off'}
          </button>
          <PrivacyShieldBadge active={protectionActive} />
        </div>
      </header>

      <div className="chat-messages">
        {messages.length === 0 && !isSending && <div className="chat-empty-state"><div className="chat-empty-icon"><Bot size={22} /></div><h2>Start a focused workspace</h2><p>Ask for route analysis, operational summaries, or attach a document. Privacy Shield checks every request before it leaves this workspace.</p><button type="button" onClick={onNewChat}>Create a new chat</button></div>}
        {messages.map((m) => (
          <div key={m.id} className={`chat-message chat-message-${m.role}`}>
            <span className="chat-message-icon">
              {m.role === 'assistant' ? <Bot size={15} /> : <User size={15} />}
            </span>
            <p>{m.text}</p>
          </div>
        ))}
        {isSending && (
          <div className="chat-message chat-message-assistant">
            <span className="chat-message-icon">
              <Bot size={15} />
            </span>
            <p className="chat-message-loading">
              <Loader2 size={14} className="spin" />
              Thinking…
            </p>
          </div>
        )}
        {policyDecision && (
          <div className={`policy-decision policy-decision-${policyDecision.level.toLowerCase()}`}>
            <AlertTriangle size={15} />
            <div><strong>{policyDecision.level}: {policyDecision.category}</strong><span>{policyDecision.explanation}</span><small>Policy rule: {policyDecision.triggeredRule}. Policy section: {policyDecision.policySection}. Risk score: {policyDecision.riskScore}/100.</small><small>{policyDecision.alternative}</small><button type="button" onClick={() => setPolicyDecision(null)}>Edit or cancel this request</button></div>
          </div>
        )}
        {error && (
          <div className="chat-error">
            <AlertTriangle size={14} />
            <span>{error}</span>
          </div>
        )}
      </div>

      {lastRoute && (
        <p className="route-indicator">
          {lastRoute.selectedModelId ? (
            <>
              Routed as <strong>{lastRoute.category}</strong> → <strong>{lastRoute.selectedModelId}</strong>
              {lastRoute.confidence < 0.6 && ' (fallback: no specialized model assigned)'}
            </>
          ) : (
            <span className="is-error">No enabled model is available for this request.</span>
          )}
        </p>
      )}

      {lastPreview && (
        <div className="privacy-preview">
          <button
            type="button"
            className="privacy-preview-toggle"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? <EyeOff size={13} /> : <Eye size={13} />}
            {showPreview ? 'Hide' : 'Show'} last redaction preview
            {lastPreview.detections.length > 0 && ` (${lastPreview.detections.length} item${lastPreview.detections.length === 1 ? '' : 's'})`}
          </button>
          {showPreview && (
            <div className="privacy-preview-body">
              <div>
                <span className="privacy-preview-label">Original</span>
                <p>{lastPreview.original}</p>
              </div>
              <div>
                <span className="privacy-preview-label">Redacted</span>
                <p>{lastPreview.redactedText}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {lastSimplification && (
        <div className="privacy-preview token-optimizer">
          <button
            type="button"
            className="privacy-preview-toggle"
            onClick={() => setOptimizerOpen((v) => !v)}
          >
            {optimizerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            Token Optimizer
            {lastSimplification.tokensSaved > 0
              ? ` — saved ~${lastSimplification.tokensSaved} tokens (${lastSimplification.percentSaved}%)`
              : ' — no tokens saved'}
          </button>
          {optimizerOpen && (
            <div className="token-optimizer-body">
              <div className="privacy-preview-body">
                <div>
                  <span className="privacy-preview-label">Redacted original</span>
                  <p>{lastSimplification.original}</p>
                </div>
                <div>
                  <span className="privacy-preview-label">Optimized</span>
                  <p>{lastSimplification.optimized}</p>
                </div>
              </div>
              <div className="token-optimizer-stats">
                <span>Original: ~{lastSimplification.originalTokens} tokens (estimate)</span>
                <span>Optimized: ~{lastSimplification.optimizedTokens} tokens (estimate)</span>
                <span className={lastSimplification.tokensSaved > 0 ? 'is-saved' : 'is-unsaved'}>
                  {lastSimplification.tokensSaved > 0
                    ? `Saved ~${lastSimplification.tokensSaved} tokens (${lastSimplification.percentSaved}%)`
                    : 'No tokens saved on this prompt'}
                </span>
                <span className="token-optimizer-mode">
                  {simplifierEnabled
                    ? lastSimplification.changed
                      ? 'Optimized prompt was sent to the provider.'
                      : 'No safe reduction found — original was sent.'
                    : 'Simplifier is off — redacted original was sent.'}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {integrityResult && <div className="integrity-panel"><div className="integrity-panel-header"><strong>{integrityResult.attachment.name}</strong><button type="button" onClick={() => setIntegrityResult(null)}>Close</button></div><p className={`integrity-risk integrity-risk-${integrityResult.result.riskLevel.toLowerCase().replaceAll(' ', '-')}`}>{integrityResult.result.riskLevel}</p><p className="integrity-meta">Document type: {integrityResult.result.documentType} · Signature: {integrityResult.result.signature.status}</p><p className="integrity-explanation">{integrityResult.result.signature.explanation}</p>{integrityResult.result.findings.length > 0 && <ul>{integrityResult.result.findings.map((item) => <li key={item.code}><strong>{item.title}</strong><span>{item.explanation}</span></li>)}</ul>}<p className="integrity-limitations"><strong>Limitations:</strong> {integrityResult.result.limitations.join(' ')}</p><p className="integrity-next">Recommended next step: compare with the issuer’s official records or ask the issuing organization to verify it.</p></div>}

      <div className="chat-input-wrap">
        <MessageInput onSend={handleSend} onIntegrityResult={(attachment, result) => setIntegrityResult({ attachment, result })} disabled={isSending} />
      </div>
    </main>
  )
}

export default ChatArea
