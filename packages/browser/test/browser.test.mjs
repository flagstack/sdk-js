import assert from 'node:assert/strict'
import test from 'node:test'

import { BrowserFlagStackClient, createBrowserClient } from '../dist/index.js'

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

test('browser client refuses secret server SDK keys', () => {
  assert.throws(
    () => new BrowserFlagStackClient({ baseUrl: 'https://flags.example.com', clientKey: 'fs_server_secret.value' }),
    /requires a FlagStack client key/,
  )
})

test('browser initializer loads configuration and evaluates locally', async () => {
  let requests = 0
  const client = await createBrowserClient({
    baseUrl: 'https://flags.example.com/',
    clientKey: 'fs_client_public-id',
    autoPoll: false,
    fetch: async (input, init) => {
      requests += 1
      assert.equal(String(input), 'https://flags.example.com/sdk/v1/config')
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer fs_client_public-id')
      return new Response(JSON.stringify(configuration), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: '"browser-v1"' },
      })
    },
  })

  assert.equal(requests, 1)
  assert.equal(client.ready, true)
  assert.equal(client.etag, '"browser-v1"')
  assert.equal(client.getBooleanValue('new-checkout', false), true)
  client.close()
})
