import { useEffect, useState } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import Workspace from './components/Workspace.jsx'
import PolicyConsentModal from './components/PolicyConsentModal.jsx'
import { ETHICS_POLICY_VERSION, readConsent } from './services/ethicsPolicy.js'

function App() {
  const [isAuthed, setIsAuthed] = useState(false)
  useEffect(() => {
    const savedTheme = localStorage.getItem('ecoroute-theme')
    if (savedTheme) document.documentElement.dataset.theme = savedTheme
  }, [])

  const toggleTheme = () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    localStorage.setItem('ecoroute-theme', next)
  }
  const [consent, setConsent] = useState(() => readConsent())
  const consentCurrent = consent?.version === ETHICS_POLICY_VERSION

  if (!isAuthed) {
    return <LoginScreen onEnter={() => setIsAuthed(true)} />
  }

  return (
    <>
      <Workspace
        onLogout={() => setIsAuthed(false)}
        consent={consent}
        onReadConsent={() => setConsent(readConsent())}
      />
      {!consentCurrent && (
        <PolicyConsentModal
          onAccepted={(next) => setConsent(next)}
          onReadPolicies={() => setConsent((current) => current || { version: null })}
        />
      )}
    </>
  )
}

export default App
