import { useEffect, useState } from 'react'
import Sidebar from './Sidebar.jsx'
import ChatArea from './ChatArea.jsx'
import ImpactDashboard from './ImpactDashboard.jsx'
import SettingsModal from './SettingsModal.jsx'
import { listProfiles } from '../services/aiService.js'
import { extractCompanyPolicyRules, policySummary } from '../services/companyPolicyService.js'
import '../styles/Workspace.css'

function Workspace({ onLogout, consent, onReadConsent }) {
  const [chats, setChats] = useState([])
  const [activeChatId, setActiveChatId] = useState(null)
  const [view, setView] = useState('chat')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [confidentialTerms, setConfidentialTerms] = useState([])
  const [protectedFiles, setProtectedFiles] = useState([])
  const [leaksBlocked, setLeaksBlocked] = useState(0)
  const [messagesByChat, setMessagesByChat] = useState({})
  const [profiles, setProfiles] = useState([])
  const [routingEnabled, setRoutingEnabled] = useState(true)
  const [manualProfileId, setManualProfileId] = useState(null)
  const [routeHistory, setRouteHistory] = useState([])
  const [ethicsActivityVersion, setEthicsActivityVersion] = useState(0)
  const [companyPolicy, setCompanyPolicy] = useState(null)

  const refreshProfiles = () => listProfiles().then(setProfiles).catch(() => setProfiles([]))
  useEffect(() => { refreshProfiles(); try { const stored = localStorage.getItem('ecoroute-company-policy'); if (stored) setCompanyPolicy(JSON.parse(stored)) } catch { /* ignore malformed local state */ } }, [])

  const defaultProfile = profiles.find((p) => p.isDefault && p.enabled) || profiles.find((p) => p.enabled) || null
  const activeMessages = activeChatId ? (messagesByChat[activeChatId] || []) : []
  const aiConfig = { configured: profiles.some((p) => p.enabled), modelId: defaultProfile?.modelId || '' }

  const handleNewChat = () => { const id = `c${Date.now()}`; setChats((current) => [{ id, title: 'New chat' }, ...current]); setActiveChatId(id); setView('chat') }
  const handleDeleteChat = (id) => { setChats((current) => current.filter((chat) => chat.id !== id)); setMessagesByChat((current) => { const next = { ...current }; delete next[id]; return next }); if (activeChatId === id) setActiveChatId(null) }
  const updateActiveMessages = (updater) => { if (!activeChatId) return; setMessagesByChat((prev) => { const current = prev[activeChatId] || []; const next = typeof updater === 'function' ? updater(current) : updater; return { ...prev, [activeChatId]: next } }) }
  const handleFileProcessed = (result) => { setProtectedFiles((prev) => [...prev, result]); if (result.terms?.length) setConfidentialTerms((prev) => [...new Set([...prev, ...result.terms])]) }
  const handleCompanyPolicy = (file, text, savedPolicy = null) => { const policy = savedPolicy?.rules ? { ...savedPolicy, contentPreview: text.slice(0, 1200) } : { id: `policy-${Date.now()}`, name: file.name, companyName: '', version: '1.0', uploadedAt: new Date().toISOString(), status: 'active', contentPreview: text.slice(0, 1200), rules: extractCompanyPolicyRules(text) }; setCompanyPolicy(policy); localStorage.setItem('ecoroute-company-policy', JSON.stringify(policy)) }
  const removeCompanyPolicy = () => { setCompanyPolicy(null); localStorage.removeItem('ecoroute-company-policy') }
  const handleRouteResult = (stats) => { setRouteHistory((current) => [...current.slice(-49), stats]); setEthicsActivityVersion((version) => version + 1) }

  return <div className="workspace">
    <Sidebar chats={chats} activeChatId={activeChatId} onSelectChat={(id) => { setActiveChatId(id); setView('chat') }} onNewChat={handleNewChat} onDeleteChat={handleDeleteChat} onOpenDashboard={() => setView('dashboard')} onOpenSettings={() => setSettingsOpen(true)} onLogout={onLogout} />
    {view === 'dashboard' ? <ImpactDashboard leaksBlocked={leaksBlocked} modelId={aiConfig.configured ? aiConfig.modelId : null} routeStats={routeHistory.at(-1)} history={routeHistory} companyPolicy={policySummary(companyPolicy)} /> : <ChatArea key={activeChatId || 'empty'} messages={activeMessages} onMessagesChange={updateActiveMessages} confidentialTerms={confidentialTerms} protectionActive={true} onRedaction={(count) => { if (count > 0) setLeaksBlocked((value) => value + count) }} aiConfigured={aiConfig.configured} modelId={aiConfig.modelId} profiles={profiles} routingEnabled={routingEnabled} manualProfileId={manualProfileId} onRouteResult={handleRouteResult} companyPolicyRules={companyPolicy?.rules || []} ethicsEnabled={consent?.version === '1.0'} onNewChat={handleNewChat} />}
    {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} protectedFiles={protectedFiles} onFileProcessed={handleFileProcessed} companyPolicy={companyPolicy} onCompanyPolicyImport={handleCompanyPolicy} onRemoveCompanyPolicy={removeCompanyPolicy} profiles={profiles} onProfilesChanged={refreshProfiles} routingEnabled={routingEnabled} onToggleRouting={setRoutingEnabled} manualProfileId={manualProfileId} onManualProfileChange={setManualProfileId} consent={consent} onReadConsent={onReadConsent} />}
  </div>
}

export default Workspace
