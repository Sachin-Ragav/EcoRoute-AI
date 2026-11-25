import { useMemo } from 'react'
import { Cpu, ShieldCheck, Scissors, Leaf, Activity, LockKeyhole } from 'lucide-react'
import '../styles/ImpactDashboard.css'

const NOT_AVAILABLE = 'Not available'

function ImpactDashboard({ leaksBlocked = 0, modelId = null, routeStats = null, history = [], companyPolicy = null }) {
  const totals = useMemo(() => history.reduce((acc, item) => ({
    tokensSaved: acc.tokensSaved + Number(item.tokensSavedBySimplifier || 0),
    requests: acc.requests + 1,
    successful: acc.successful + (item.success ? 1 : 0),
  }), { tokensSaved: 0, requests: 0, successful: 0 }), [history])
  // Conservative estimate: 0.0003 Wh per saved token. This is a configurable
  // proxy, not a measured provider energy/emissions value.
  const energyWh = totals.tokensSaved * 0.0003
  const co2g = energyWh * 0.0004

  return <main className="impact-page">
    <header className="impact-page-header"><div><p className="eyebrow">Operational insights</p><h1>Impact dashboard</h1><p>Measured activity from this workspace. Environmental figures are estimates, never measured emissions.</p></div><span className="impact-model-pill"><Cpu size={14} /> {modelId || 'No model connected'}</span></header>

    <section className="impact-section"><div className="impact-section-heading"><div><p className="eyebrow">Efficiency</p><h2>Token savings</h2></div><Scissors size={19} /></div><div className="impact-kpi-grid"><article className="impact-kpi impact-kpi-primary"><span>Total estimated tokens saved</span><strong>{totals.requests ? totals.tokensSaved.toLocaleString() : NOT_AVAILABLE}</strong><small>From locally simplified prompts</small></article><article className="impact-kpi"><span>Latest session</span><strong>{routeStats ? `~${routeStats.tokensSavedBySimplifier || 0}` : NOT_AVAILABLE}</strong><small>Estimated tokens saved</small></article><article className="impact-kpi"><span>Reduction rate</span><strong>{routeStats?.inputTokensEstimate ? `${Math.round((routeStats.tokensSavedBySimplifier / routeStats.inputTokensEstimate) * 100)}%` : NOT_AVAILABLE}</strong><small>Last processed prompt</small></article></div></section>

    <section className="impact-section"><div className="impact-section-heading"><div><p className="eyebrow">Protection</p><h2>Privacy Shield</h2></div><ShieldCheck size={19} /></div><div className="impact-kpi-grid"><article className="impact-kpi"><span>Total redactions</span><strong>{leaksBlocked}</strong><small>Masked locally before provider access</small></article><article className="impact-kpi"><span>Detected categories</span><strong>{leaksBlocked ? 'Active' : '—'}</strong><small>Values are never displayed here</small></article><article className="impact-kpi"><span>Company policy</span><strong>{companyPolicy ? 'Enabled' : 'Not configured'}</strong><small>{companyPolicy ? `${companyPolicy.ruleCount} source-backed rules` : 'Import a policy in Settings'}</small></article></div><div className="impact-safe-example"><LockKeyhole size={15} /><span>Safe preview: <code>[EMAIL_1]</code> and <code>[CONFIDENTIAL_1]</code> — original values are intentionally unavailable.</span></div></section>

    <section className="impact-section"><div className="impact-section-heading"><div><p className="eyebrow">Environmental estimate</p><h2>CO₂ impact</h2></div><Leaf size={19} /></div>{totals.requests ? <div className="impact-kpi-grid"><article className="impact-kpi impact-kpi-primary"><span>Estimated emissions avoided</span><strong>{co2g.toFixed(4)} g</strong><small>Proxy estimate based on {totals.tokensSaved.toLocaleString()} saved tokens</small></article><article className="impact-kpi"><span>Estimated energy saved</span><strong>{energyWh.toFixed(3)} Wh</strong><small>Calculation proxy, not measured consumption</small></article><article className="impact-kpi"><span>Requests analyzed</span><strong>{totals.requests}</strong><small>{totals.successful} completed successfully</small></article></div> : <div className="impact-empty"><Activity size={18} /><div><strong>No environmental estimate yet</strong><p>Send a prompt with Token Simplifier enabled to create a measured token-saving event. No savings are fabricated.</p></div></div>}<details className="impact-methodology"><summary>Methodology & assumptions</summary><p>Estimate only: energy = saved tokens × 0.0003 Wh/token; CO₂ = energy × 0.0004 g/Wh. These configurable proxy factors are disclosed for demonstration, not a measurement or compliance claim.</p></details></section>
  </main>
}

export default ImpactDashboard
