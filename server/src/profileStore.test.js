import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'

// Point the store at a throwaway file before importing it, so tests
// never touch real configuration.
const tmpFile = path.join(os.tmpdir(), `model-profiles-test-${Date.now()}.json`)
process.env.MODEL_PROFILES_FILE = tmpFile

const store = await import('./profileStore.js')

afterAll(() => {
  fs.rmSync(tmpFile, { force: true })
})

beforeEach(() => {
  fs.rmSync(tmpFile, { force: true })
})

describe('profileStore', () => {
  it('creates the first profile as the default automatically', () => {
    const p = store.upsertProfile({ name: 'Default', baseUrl: 'https://a.test', apiKey: 'k1', modelId: 'm1' })
    expect(p.isDefault).toBe(true)
  })

  it('persists profiles across reads (survives "restart")', () => {
    store.upsertProfile({ name: 'P1', baseUrl: 'https://a.test', apiKey: 'k1', modelId: 'm1' })
    const listed = store.listProfiles()
    expect(listed).toHaveLength(1)
    expect(listed[0].name).toBe('P1')
  })

  it('never exposes apiKey via listProfiles', () => {
    store.upsertProfile({ name: 'P1', baseUrl: 'https://a.test', apiKey: 'super-secret', modelId: 'm1' })
    const listed = store.listProfiles()
    expect(listed[0].apiKey).toBeUndefined()
    expect(JSON.stringify(listed)).not.toContain('super-secret')
  })

  it('getProfileInternal includes the apiKey for server-side provider calls', () => {
    const created = store.upsertProfile({ name: 'P1', baseUrl: 'https://a.test', apiKey: 'super-secret', modelId: 'm1' })
    const internal = store.getProfileInternal(created.id)
    expect(internal.apiKey).toBe('super-secret')
  })

  it('updates an existing profile without requiring the apiKey again', () => {
    const created = store.upsertProfile({ name: 'P1', baseUrl: 'https://a.test', apiKey: 'secret', modelId: 'm1' })
    const updated = store.upsertProfile({ id: created.id, name: 'P1 renamed' })
    expect(updated.name).toBe('P1 renamed')
    expect(store.getProfileInternal(created.id).apiKey).toBe('secret') // key preserved
  })

  it('deletes a profile and promotes a new default if needed', () => {
    const a = store.upsertProfile({ name: 'A', baseUrl: 'x', apiKey: 'k', modelId: 'm', isDefault: true })
    const b = store.upsertProfile({ name: 'B', baseUrl: 'x', apiKey: 'k', modelId: 'm' })
    store.deleteProfile(a.id)
    const listed = store.listProfiles()
    expect(listed.find((p) => p.id === b.id).isDefault).toBe(true)
  })

  it('setDefaultProfile makes exactly one profile the default', () => {
    const a = store.upsertProfile({ name: 'A', baseUrl: 'x', apiKey: 'k', modelId: 'm' })
    const b = store.upsertProfile({ name: 'B', baseUrl: 'x', apiKey: 'k', modelId: 'm' })
    store.setDefaultProfile(b.id)
    const listed = store.listProfiles()
    expect(listed.find((p) => p.id === a.id).isDefault).toBe(false)
    expect(listed.find((p) => p.id === b.id).isDefault).toBe(true)
  })

  it('sanitizes capabilities to the known set only', () => {
    const p = store.upsertProfile({
      name: 'A',
      baseUrl: 'x',
      apiKey: 'k',
      modelId: 'm',
      capabilities: ['coding', 'not-a-real-capability'],
    })
    expect(p.capabilities).toEqual(['coding'])
  })

  it('rejects creating a profile missing required fields', () => {
    expect(() => store.upsertProfile({ name: 'Incomplete' })).toThrow()
  })

  it('getDefaultProfileInternal skips disabled defaults', () => {
    const a = store.upsertProfile({ name: 'A', baseUrl: 'x', apiKey: 'k', modelId: 'm', isDefault: true, enabled: false })
    const b = store.upsertProfile({ name: 'B', baseUrl: 'x', apiKey: 'k', modelId: 'm', enabled: true })
    const def = store.getDefaultProfileInternal()
    expect(def.id).toBe(b.id)
  })
})
