import { Leaf, Chrome } from 'lucide-react'
import '../styles/LoginScreen.css'

function LoginScreen({ onEnter }) {
  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-brand">
          <span className="login-brand-icon">
            <Leaf size={22} />
          </span>
          <span className="login-brand-name">EcoRoute AI</span>
        </div>

        <h1>Welcome back</h1>
        <p className="login-sub">
          Sign in to continue to your workspace.
        </p>

        <button type="button" className="login-btn login-btn-google">
          <Chrome size={18} />
          Continue with Google
        </button>

        <div className="login-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="login-btn login-btn-demo"
          onClick={onEnter}
        >
          Enter Demo Workspace
        </button>

        <p className="login-footnote">
          Demo mode uses no real account or API keys.
        </p>
      </div>
    </div>
  )
}

export default LoginScreen
