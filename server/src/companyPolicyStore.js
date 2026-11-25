import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { extractCompanyPolicyRules, policySummary } from '../../src/services/companyPolicyService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.COMPANY_POLICY_DIR || path.join(__dirname, '..', 'data')
const STORE_FILE = process.env.COMPANY_POLICY_FILE || path.join(DATA_DIR, 'company-policy.json')

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 })
  if (!fs.existsSync(STORE_FILE)) fs.writeFileSync(STORE_FILE, JSON.stringify({ policy: null }), { mode: 0o600 })
}
function read() {
  ensureStore()
  try { return JSON.parse(fs.readFileSync(STORE_FILE, 'utf8')).policy || null } catch { return null }
}
function write(policy) { ensureStore(); fs.writeFileSync(STORE_FILE, JSON.stringify({ policy }, null, 2), { mode: 0o600 }) }

export function getCompanyPolicy() { return read() }
export function getCompanyPolicySummary() {
  const policy = read()
  if (!policy) return null
  return {
    ...policySummary(policy),
    rules: policy.rules || [],
    contentPreview: policy.content ? policy.content.slice(0, 1200) : '',
  }
}
export function getCompanyPolicyPublic() { return getCompanyPolicySummary() }
export function saveCompanyPolicy({ name, companyName = '', version = '1.0', content }) {
  if (!name || typeof content !== 'string' || !content.trim()) throw new Error('A policy name and extractable policy content are required.')
  const policy = {
    id: `company-policy-${Date.now()}`,
    name: String(name).slice(0, 160),
    companyName: String(companyName).slice(0, 160),
    version: String(version).slice(0, 40),
    uploadedAt: new Date().toISOString(),
    status: 'active',
    content: content.slice(0, 500000),
    rules: extractCompanyPolicyRules(content),
  }
  write(policy)
  return policy
}
export function updateCompanyPolicyRules(rules) {
  const policy = read()
  if (!policy) return null
  const allowed = new Set(['WARNING', 'RESTRICTED', 'BLOCKED'])
  policy.rules = (Array.isArray(rules) ? rules : []).map((rule) => ({ ...rule, enforcement: allowed.has(rule.enforcement) ? rule.enforcement : 'WARNING' }))
  write(policy)
  return policy
}
export function removeCompanyPolicy() { write(null); return true }
