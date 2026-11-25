import { describe, expect, it } from 'vitest'
import { checkCompanyPolicy, extractCompanyPolicyRules } from './companyPolicyService.js'

describe('company policy guard', () => {
  const rules = extractCompanyPolicyRules('Confidential information must not be shared with external AI providers. Customer data may not be disclosed outside the company.')

  it('extracts explicit source-backed rules', () => {
    expect(rules.map((rule) => rule.category)).toEqual(expect.arrayContaining(['CONFIDENTIAL_INFORMATION', 'CUSTOMER_INFORMATION', 'EXTERNAL_AI_SHARING']))
    expect(rules[0].sourceExcerpt).toContain('must not')
  })

  it('warns on a matching sharing request but allows ordinary prompts', () => {
    expect(checkCompanyPolicy('Please share the confidential customer report with the external AI provider.', rules).violations.length).toBeGreaterThan(0)
    expect(checkCompanyPolicy('Help me plan a warehouse route.', rules).level).toBe('ALLOWED')
  })
})
