import assert from 'node:assert/strict'
import test from 'node:test'

import { NodeFlagStackClient, createNodeClient } from '../dist/index.js'

const configuration = {
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
      policy: {},
      revision: 1,
    },
  ],
  segments: [],
}

test('node client refuses public client SDK keys', () => {
  assert.throws(
    () => new NodeFlagStackClient({ baseUrl: 'https://flags.example.com', serverKey: 'fs_client_public-id' }),
    /requires a FlagStack server key/,
  )
})

test('node initializer loads configuration without requiring background polling', async () => {
  let requests = 0
  const client = await createNodeClient({
    baseUrl: 'https://flags.example.com',
    serverKey: 'fs_server_credential.secret',
    fetch: async (input, init) => {
      requests += 1
      assert.equal(String(input), 'https://flags.example.com/sdk/v1/config')
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fs_server_credential.secret')
      return new Response(JSON.stringify(configuration), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: '"node-v1"' },
      })
    },
  })

  assert.equal(requests, 1)
  assert.equal(client.ready, true)
  assert.equal(client.etag, '"node-v1"')
  assert.equal(client.getBooleanValue('new-checkout', false), true)
  client.close()
})
