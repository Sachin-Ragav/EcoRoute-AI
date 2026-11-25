import { useState } from 'react'
import { CheckCircle2, FileText, ShieldAlert } from 'lucide-react'
import { ETHICS_POLICY_UPDATED, ETHICS_POLICY_VERSION, readEthicsActivity } from '../services/ethicsPolicy.js'

const privacySections = [
  ['Information processed', 'EcoRoute AI processes prompts, conversation messages, selected model settings, and supported TXT/CSV uploads that you choose to provide. The Privacy Shield can identify common patterns and terms you configure; it is not a guarantee that every sensitive item will be found.'],
  ['Local and cloud processing', 'Privacy Shield redaction, deterministic ethics checks, token simplification, and model routing run locally in this browser. The redacted (and, when enabled, simplified) conversation is sent to this application’s backend, which forwards it to the provider configured in Settings.'],
  ['Provider sharing', 'Only the processed messages required for a request and the selected profile/model are sent to the configured AI provider. Provider terms, retention, and logging may apply; review that provider’s documentation. EcoRoute AI does not claim control over provider practices.'],
  ['Credentials and security', 'API credentials are submitted to the application backend and are kept server-side by the current prototype. This demo does not claim encryption, enterprise security certification, or protection from every attack. Never enter credentials into prompts.'],
  ['Storage and retention', 'The prototype stores model profile configuration in its server-side profile store and stores consent/activity metadata in this browser. Chat state is held in the active browser session. Exact production retention, backup, deletion, and regional processing rules require company confirmation.'],
  ['Controls and deletion', 'You can review this centre, consent status, and local ethics activity in Settings. Clear this browser’s site data to remove local consent/activity metadata. Provider-side deletion and server profile deletion depend on the configured implementation and provider; a production deletion workflow is a company-confirmation placeholder.'],
  ['Rights and contact', 'Privacy rights and grievance routes depend on the user’s location and the eventual operating entity. Contact: [Company privacy contact — configure before deployment]. This draft is not legal advice and requires legal review before commercial use.'],
]

const ethicsSections = [
  ['Allowed use', 'Use EcoRoute AI for legitimate research, writing, analysis, accessibility, learning, and assistance with your own documents. Questions about protecting Aadhaar, summarizing your own PAN, summarizing a certificate, or explaining digital signatures are allowed.'],
  ['Prohibited use', 'Do not use the service for identity theft or impersonation; unauthorized disclosure of personal or confidential information; forgery or fraudulent alteration of official documents; misuse of identity documents; deceptive certificates or credentials; circumventing security, privacy, authentication, or verification protections; or other harmful, deceptive, or unlawful activity.'],
  ['How enforcement works', 'Deterministic local rules may warn, restrict, or block a request based on context. Sensitive words alone are not violations. A blocked request is stopped before the backend AI request. Decisions are explainable but can be imperfect; do not include unnecessary sensitive content.'],
  ['Safe alternatives and reporting', 'For a blocked request, ask for prevention, authenticity checks, consent-based workflows, official recovery, or reporting guidance. If a decision is incorrect, report it to [Company support or ethics contact — configure before deployment].'],
]

function Document({ title, sections }) {
  return <article className="policy-document"><div className="policy-document-heading"><FileText size={16} /><div><h4>{title}</h4><span>Hackathon-ready draft · requires legal review</span></div></div>{sections.map(([heading, text]) => <section key={heading}><h5>{heading}</h5><p>{text}</p></section>)}</article>
}

function PrivacyEthicsCentre({ consent, onReadConsent }) {
  const [tab, setTab] = useState('overview')
  const activity = readEthicsActivity()
  const count = (level) => activity.filter((event) => event.level === level).length

  return <section className="settings-section privacy-ethics-centre">
    <div className="privacy-ethics-title"><div><h3>Privacy & Ethics Centre</h3><p className="settings-hint">Policy v{ETHICS_POLICY_VERSION} · Last updated {ETHICS_POLICY_UPDATED}. Draft for the hackathon demonstration.</p></div><ShieldAlert size={20} /></div>
    <div className="policy-tabs"><button type="button" className={tab === 'overview' ? 'is-active' : ''} onClick={() => setTab('overview')}>Overview</button><button type="button" className={tab === 'privacy' ? 'is-active' : ''} onClick={() => setTab('privacy')}>Privacy Policy</button><button type="button" className={tab === 'ethics' ? 'is-active' : ''} onClick={() => setTab('ethics')}>Acceptable Use</button><button type="button" className={tab === 'activity' ? 'is-active' : ''} onClick={() => setTab('activity')}>Activity</button></div>
    {tab === 'overview' && <div className="policy-overview"><p>Privacy Shield and ethics checks run before the token simplifier, Smart Model Router, backend, and provider. No full prompts are stored in ethics activity history.</p><div className="consent-status"><CheckCircle2 size={15} /><span><strong>{consent?.version === ETHICS_POLICY_VERSION ? 'Current agreement accepted' : 'Agreement acknowledgement required'}</strong><small>{consent?.acceptedAt ? `Accepted ${new Date(consent.acceptedAt).toLocaleString()}` : 'Chat is paused until the current version is accepted.'}</small></span><button type="button" className="settings-btn" onClick={onReadConsent}>{consent?.version === ETHICS_POLICY_VERSION ? 'Review' : 'Acknowledge'}</button></div></div>}
    {tab === 'privacy' && <Document title="EcoRoute AI Privacy Policy" sections={privacySections} />}
    {tab === 'ethics' && <Document title="AI Ethics & Acceptable Use Agreement" sections={ethicsSections} />}
    {tab === 'activity' && <div className="ethics-activity"><div className="ethics-stats"><span><strong>{count('WARNING')}</strong>Warnings</span><span><strong>{count('RESTRICTED')}</strong>Restricted</span><span><strong>{count('BLOCKED')}</strong>Blocked</span></div>{activity.length === 0 ? <p className="settings-hint">No policy decisions recorded yet. This is actual recorded activity, not sample demonstration data.</p> : <ul>{activity.map((event, index) => <li key={`${event.timestamp}-${index}`}><strong>{event.level}</strong><span>{event.category}</span><time>{new Date(event.timestamp).toLocaleString()}</time></li>)}</ul>}</div>}
  </section>
}

export default PrivacyEthicsCentre
