import assert from 'node:assert/strict'
import test from 'node:test'
import { createNextFlagStack } from '../dist/server.js'
import { useBooleanFlag } from '../dist/client.js'

function configuration() {
  return {
    schema_version: 1,
    environment: { id: 'env-1', key: 'production' },
    flags: [
      {
        id: 'flag-1',
        key: 'server-feature',
        kind: 'boolean',
        default_value: false,
        enabled: true,
        variants: [],
        policy: {},
        revision: 1,
      },
    ],
    segments: [],
  }
}

test('Next server helper loads and evaluates server configuration', async () => {
  const flagstack = createNextFlagStack({
    baseUrl: 'https://flags.example.com',
    serverKey: 'fs_server_test.secret',
    fetch: async () => new Response(JSON.stringify(configuration()), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  })

  const client = await flagstack.getClient()
  assert.equal(client.getBooleanValue('server-feature', false), true)
})

test('Next client entry exposes React hooks', () => {
  assert.equal(typeof useBooleanFlag, 'function')
})
