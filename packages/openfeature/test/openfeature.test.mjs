import assert from 'node:assert/strict'
import test from 'node:test'
import { ErrorCode as ServerErrorCode } from '@openfeature/server-sdk'
import { ProviderEvents as ClientProviderEvents } from '@openfeature/web-sdk'
import { FlagStackClientProvider } from '../dist/client.js'
import { FlagStackServerProvider } from '../dist/server.js'

function configuration(revision = 1) {
  return {
    schema_version: 1,
    environment: { id: 'env-1', key: 'production' },
    flags: [
      {
        id: 'flag-1',
        key: 'new-checkout',
        kind: 'boolean',
        default_value: false,
        enabled: true,
        variants: [],
        policy: {
          rules: [
            {
              id: 'joined-on-launch-day',
              match: 'all',
              conditions: [
                {
                  attribute: 'joinedAt',
                  operator: 'equals',
                  value: '2026-08-20T00:00:00.000Z',
                },
              ],
              outcome: { variant: 'on' },
            },
          ],
          fallthrough: { variant: 'off' },
        },
        revision,
      },
    ],
    segments: [],
  }
}

function response(payload, etag) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ETag: etag,
    },
  })
}

test('server provider resolves through the OpenFeature provider contract', async () => {
  const provider = new FlagStackServerProvider({
    baseUrl: 'https://flags.example.com',
    serverKey: 'fs_server_test',
    autoPoll: false,
    fetch: async () => response(configuration(), '"config-1"'),
  })

  await provider.initialize()
  const details = await provider.resolveBooleanEvaluation(
    'new-checkout',
    false,
    { joinedAt: new Date('2026-08-20T00:00:00.000Z') },
  )

  assert.equal(provider.metadata.name, 'FlagStack')
  assert.equal(provider.runsOn, 'server')
  assert.equal(details.value, true)
  assert.equal(details.variant, 'on')
  assert.equal(details.reason, 'TARGETING_MATCH')
  assert.equal(details.flagMetadata['flagstack.environment'], 'production')
  assert.equal(details.flagMetadata['flagstack.revision'], 1)
  assert.equal(details.flagMetadata['flagstack.rule_id'], 'joined-on-launch-day')

  const missing = await provider.resolveBooleanEvaluation('missing', false, {})
  assert.equal(missing.value, false)
  assert.equal(missing.reason, 'ERROR')
  assert.equal(missing.errorCode, ServerErrorCode.FLAG_NOT_FOUND)

  await provider.onClose()
})

test('client provider emits configuration change events after initialization', async () => {
  const payloads = [configuration(1), configuration(2)]
  let request = 0
  const provider = new FlagStackClientProvider({
    baseUrl: 'https://flags.example.com',
    clientKey: 'fs_client_test',
    autoPoll: false,
    fetch: async () => {
      const index = Math.min(request, payloads.length - 1)
      request += 1
      return response(payloads[index], `"config-${index + 1}"`)
    },
  })

  let changes = 0
  provider.events.addHandler(ClientProviderEvents.ConfigurationChanged, () => {
    changes += 1
  })

  await provider.initialize()
  assert.equal(changes, 0)

  await provider.client.refresh()
  assert.equal(changes, 1)

  const details = provider.resolveBooleanEvaluation(
    'new-checkout',
    false,
    { joinedAt: new Date('2026-08-20T00:00:00.000Z') },
  )
  assert.equal(provider.runsOn, 'client')
  assert.equal(details.value, true)
  assert.equal(details.flagMetadata['flagstack.revision'], 2)

  await provider.onClose()
})
