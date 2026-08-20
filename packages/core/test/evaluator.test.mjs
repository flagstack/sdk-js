import assert from 'node:assert/strict'
import test from 'node:test'
import { bucket, evaluateFlag } from '../dist/index.js'

function booleanFlag(overrides = {}) {
  return {
    id: 'flag-1',
    key: 'new-checkout',
    kind: 'boolean',
    default_value: false,
    enabled: true,
    variants: [],
    policy: {},
    revision: 1,
    ...overrides,
  }
}

test('bucket matches the FlagStack v1 compatibility vector', () => {
  assert.equal(bucket('env-1', 'flag-1', 'user-123'), 22683)
})

test('disabled flags return the project default', () => {
  assert.deepEqual(
    evaluateFlag(booleanFlag({ enabled: false }), 'env-1'),
    { value: false, variant: 'default', reason: 'DISABLED' },
  )
})

test('enabled boolean flags without policy return the on variant', () => {
  assert.deepEqual(
    evaluateFlag(booleanFlag(), 'env-1'),
    { value: true, variant: 'on', reason: 'STATIC' },
  )
})

test('ordered targeting rules and transitive segments evaluate locally', () => {
  const flag = booleanFlag({
    policy: {
      rules: [
        {
          id: 'staff-rule',
          match: 'all',
          conditions: [{ operator: 'in_segment', value: 'staff' }],
          outcome: { variant: 'on' },
        },
      ],
      fallthrough: { variant: 'off' },
    },
  })
  const segments = [
    {
      key: 'staff',
      name: 'Staff',
      match: 'all',
      conditions: [{ operator: 'in_segment', value: 'internal' }],
    },
    {
      key: 'internal',
      name: 'Internal',
      match: 'all',
      conditions: [{ attribute: 'profile.email', operator: 'ends_with', value: '@example.com' }],
    },
  ]

  assert.deepEqual(
    evaluateFlag(flag, 'env-1', { targetingKey: 'user-1', profile: { email: 'adam@example.com' } }, segments),
    { value: true, variant: 'on', reason: 'TARGETING_MATCH', ruleId: 'staff-rule' },
  )
  assert.deepEqual(
    evaluateFlag(flag, 'env-1', { targetingKey: 'user-2', profile: { email: 'user@elsewhere.test' } }, segments),
    { value: false, variant: 'off', reason: 'STATIC' },
  )
})

test('percentage rollout uses stable local bucketing', () => {
  const flag = booleanFlag({
    policy: {
      fallthrough: {
        rollout: [
          { variant: 'on', weight: 25_000 },
          { variant: 'off', weight: 75_000 },
        ],
      },
    },
  })

  assert.equal(bucket('env-1', 'flag-1', 'user-123'), 22683)
  assert.deepEqual(
    evaluateFlag(flag, 'env-1', { targetingKey: 'user-123' }),
    { value: true, variant: 'on', reason: 'SPLIT' },
  )
})

test('rollout without targeting key fails safely with reference error code', () => {
  const flag = booleanFlag({
    policy: {
      fallthrough: {
        rollout: [
          { variant: 'on', weight: 50_000 },
          { variant: 'off', weight: 50_000 },
        ],
      },
    },
  })
  const result = evaluateFlag(flag, 'env-1')
  assert.equal(result.value, false)
  assert.equal(result.variant, 'default')
  assert.equal(result.reason, 'ERROR')
  assert.equal(result.errorCode, 'TARGETING_KEY_MISSING')
})

test('regex matching uses Go-compatible RE2 syntax', () => {
  const flag = booleanFlag({
    policy: {
      rules: [
        {
          id: 'staff-email',
          match: 'all',
          conditions: [{ attribute: 'email', operator: 'matches_regex', value: '(?i)@example\\.com$' }],
          outcome: { variant: 'on' },
        },
      ],
      fallthrough: { variant: 'off' },
    },
  })

  assert.equal(evaluateFlag(flag, 'env-1', { email: 'Adam@EXAMPLE.COM' }).value, true)
  assert.equal(evaluateFlag(flag, 'env-1', { email: 'user@elsewhere.test' }).value, false)
})

test('semantic-version operators accept Go x/mod shorthand versions', () => {
  const flag = booleanFlag({
    policy: {
      rules: [
        {
          id: 'modern-app',
          match: 'all',
          conditions: [{ attribute: 'app_version', operator: 'semver_greater_than_or_equal', value: '2.4' }],
          outcome: { variant: 'on' },
        },
      ],
      fallthrough: { variant: 'off' },
    },
  })
  assert.equal(evaluateFlag(flag, 'env-1', { app_version: 'v2.4.1' }).value, true)
  assert.equal(evaluateFlag(flag, 'env-1', { app_version: '2.3.9' }).value, false)
})

test('segment cycles fail safely instead of recursing', () => {
  const flag = booleanFlag({
    policy: {
      rules: [{
        id: 'cycle',
        match: 'all',
        conditions: [{ operator: 'in_segment', value: 'a' }],
        outcome: { variant: 'on' },
      }],
    },
  })
  const segments = [
    { key: 'a', name: 'A', match: 'all', conditions: [{ operator: 'in_segment', value: 'b' }] },
    { key: 'b', name: 'B', match: 'all', conditions: [{ operator: 'in_segment', value: 'a' }] },
  ]
  const result = evaluateFlag(flag, 'env-1', {}, segments)
  assert.equal(result.reason, 'ERROR')
  assert.equal(result.errorCode, 'PARSE_ERROR')
})
