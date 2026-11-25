import { useState } from 'react'
import { ShieldCheck, X } from 'lucide-react'
import { ETHICS_POLICY_VERSION, saveConsent } from '../services/ethicsPolicy.js'
import '../styles/PolicyConsentModal.css'

function PolicyConsentModal({ onAccepted, onDeclined, onReadPolicies }) {
  const [declined, setDeclined] = useState(false)
  const [showPolicies, setShowPolicies] = useState(false)

  return (
    <div className="consent-overlay">
      <div className="consent-card" role="dialog" aria-modal="true" aria-labelledby="consent-title">
        <div className="consent-icon"><ShieldCheck size={24} /></div>
        <p className="consent-kicker">Before you continue · Policy v{ETHICS_POLICY_VERSION}</p>
        <h2 id="consent-title">AI Ethics & Acceptable Use</h2>
        <p>
          EcoRoute AI is a hackathon demonstration. Please review the acceptable-use agreement before sending requests to a configured AI provider.
          This agreement helps prevent identity abuse, fraud, unauthorized disclosure, and security bypasses.
        </p>
        <button type="button" className="consent-link" onClick={() => { setShowPolicies((value) => !value); onReadPolicies?.() }}>Read the Privacy Policy and full Agreement</button>
        {showPolicies && <div className="consent-summary"><strong>Privacy Policy:</strong> prompts and uploaded TXT/CSV content are processed locally for redaction before the processed conversation is sent to your configured provider. <strong>Acceptable Use:</strong> do not use EcoRoute AI for identity theft, unauthorized disclosure, document forgery, deceptive credentials, or security bypasses. Full documents are available in Settings after entering the workspace.</div>}
        {declined && <p className="consent-declined"><X size={14} /> You declined. AI chat remains unavailable until this agreement is accepted.</p>}
        <div className="consent-actions">
          <button type="button" className="settings-btn" onClick={() => { setDeclined(true); onDeclined?.() }}>Decline</button>
          <button type="button" className="settings-btn settings-btn-primary" onClick={() => onAccepted(saveConsent())}>Accept and continue</button>
        </div>
        <small>Acceptance is stored in this browser for the local demo installation. It is not proof of verified identity or a legal contract.</small>
      </div>
    </div>
  )
}

export default PolicyConsentModal
