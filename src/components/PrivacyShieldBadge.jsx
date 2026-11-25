import { ShieldCheck, ShieldOff } from 'lucide-react'
import '../styles/PrivacyShieldBadge.css'

function PrivacyShieldBadge({ active = false }) {
  return (
    <div className={`privacy-shield${active ? '' : ' is-inactive'}`}>
      {active ? <ShieldCheck size={14} /> : <ShieldOff size={14} />}
      <span>{active ? 'Protection active' : 'Not configured'}</span>
    </div>
  )
}

export default PrivacyShieldBadge
