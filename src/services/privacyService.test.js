import { describe, it, expect } from 'vitest'
import { redactText, extractConfidentialTerms } from './privacyService.js'

describe('redactText — built-in detectors', () => {
  it('detects and redacts an email address', () => {
    const { redactedText, categories, totalDetections } = redactText(
      'Contact me at jane.doe@example.com for details.',
    )
    expect(redactedText).toContain('[EMAIL_1]')
    expect(redactedText).not.toContain('jane.doe@example.com')
    expect(categories.EMAIL).toBe(1)
    expect(totalDetections).toBe(1)
  })

  it('detects a plain 10-digit Indian mobile number', () => {
    const { redactedText, categories } = redactText('Call me on 9876543210 tomorrow.')
    expect(redactedText).toContain('[PHONE_1]')
    expect(categories.PHONE).toBe(1)
  })

  it('detects an Indian number grouped as 5+5', () => {
    const { categories } = redactText('My number is 98765 43210.')
    expect(categories.PHONE).toBe(1)
  })

  it('detects an international number with country code', () => {
    const { categories } = redactText('Reach us at +1 415 555 2671 anytime.')
    expect(categories.PHONE).toBe(1)
  })

  it('detects a dash-grouped US-style number', () => {
    const { categories } = redactText('Phone: 415-555-2671')
    expect(categories.PHONE).toBe(1)
  })

  it('detects a parenthesised area code number', () => {
    const { categories } = redactText('Office: (415) 555-2671')
    expect(categories.PHONE).toBe(1)
  })

  it('does not flag an ordinary short number as a phone', () => {
    const { categories } = redactText('Order #12345 shipped, quantity 42.')
    expect(categories.PHONE).toBeUndefined()
  })

  it('detects and redacts a PAN-like pattern', () => {
    const { redactedText, categories } = redactText('My PAN is ABCDE1234F, keep it safe.')
    expect(redactedText).toContain('[PAN_1]')
    expect(categories.PAN).toBe(1)
  })

  it('detects and redacts an Aadhaar-like 12-digit number', () => {
    const { redactedText, categories } = redactText('Aadhaar: 1234 5678 9012')
    expect(redactedText).toContain('[AADHAAR_1]')
    expect(categories.AADHAAR).toBe(1)
  })

  it('detects and redacts a credit card number', () => {
    const { redactedText, categories } = redactText('Card: 4111 1111 1111 1111 please charge it')
    expect(redactedText).toContain('[CREDIT_CARD_1]')
    expect(categories.CREDIT_CARD).toBe(1)
  })

  it('returns no detections for plain text', () => {
    const { totalDetections, redactedText } = redactText('Just a normal sentence.')
    expect(totalDetections).toBe(0)
    expect(redactedText).toBe('Just a normal sentence.')
  })
})

describe('redactText — custom confidential terms', () => {
  it('redacts a custom confidential phrase case-insensitively', () => {
    const { redactedText, categories } = redactText(
      'The Phoenix Project launch is delayed.',
      ['phoenix project'],
    )
    expect(redactedText).toContain('[CONFIDENTIAL_1]')
    expect(redactedText).not.toMatch(/phoenix project/i)
    expect(categories.CONFIDENTIAL).toBe(1)
  })

  it('matches longer confidential phrases before shorter overlapping ones', () => {
    const { detections } = redactText('Project Eco Route Alpha is internal.', [
      'Eco Route',
      'Eco Route Alpha',
    ])
    expect(detections[0].original).toBe('Eco Route Alpha')
  })

  it('keeps original values only in the returned detections, not in redactedText', () => {
    const { redactedText, detections } = redactText('Secret: Falcon', ['Falcon'])
    expect(redactedText).not.toContain('Falcon')
    expect(detections[0].original).toBe('Falcon')
  })
})

describe('extractConfidentialTerms', () => {
  it('extracts one term per non-empty line from a TXT file', () => {
    const terms = extractConfidentialTerms('Project Falcon\n\nAcme Corp\n', 'notes.txt')
    expect(terms).toEqual(['Project Falcon', 'Acme Corp'])
  })

  it('extracts one term per non-empty cell from a CSV file', () => {
    const terms = extractConfidentialTerms('Falcon,Acme Corp\n,Jane Doe\n', 'notes.csv')
    expect(terms).toEqual(['Falcon', 'Acme Corp', 'Jane Doe'])
  })

  it('de-duplicates terms case-insensitively', () => {
    const terms = extractConfidentialTerms('Falcon\nfalcon\nFALCON', 'notes.txt')
    expect(terms).toEqual(['Falcon'])
  })

  it('parses quoted CSV cells containing commas', () => {
    const terms = extractConfidentialTerms('"Acme, Inc.",Falcon\n"Doe, Jane",', 'notes.csv')
    expect(terms).toEqual(['Acme, Inc.', 'Falcon', 'Doe, Jane'])
  })
})
