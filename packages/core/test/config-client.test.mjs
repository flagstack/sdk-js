import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FlagStackAuthenticationError,
  FlagStackClient,
  FlagStackConfigurationError,
} from '../dist/index.js'

function configuration(overrides = {}) {
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
        policy: {},
        revision: 1,
      },
      {
        id: 'flag-2',
        key: 'headline',
        kind: 'string',
        default_value: 'Control',
        enabled: true,
        variants: [],
        policy: {},
        revision: 0,
      },
    ],
    segments: [],
    ...overrides,
  }
}

test('refresh loads schema v1, retains ETag and evaluates synchronously', async () => {
  const requests = []
  const fetch = async (url, init) => {
    requests.push({ url, init })
    return new Response(JSON.stringify(configuration()), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ETag: '"sha256-one"' },
    })
  }
  const client = new FlagStackClient({ baseUrl: 'https://flags.example.test/', sdkKey: 'fs_client_public', fetch })

  assert.equal(client.ready, false)
  assert.equal(client.getBooleanValue('new-checkout', false), false)
  assert.equal(await client.refresh(), 'updated')
  assert.equal(client.ready, true)
  assert.equal(client.etag, '"sha256-one"')
  assert.equal(client.getBooleanValue('new-checkout', false), true)
  assert.equal(client.getStringValue('headline', 'fallback'), 'Control')
  assert.equal(requests[0].url, 'https://flags.example.test/sdk/v1/config')
  assert.equal(requests[0].init.headers.get('Authorization'), 'Bearer fs_client_public')
})

test('conditional refresh sends If-None-Match and accepts 304', async () => {
  const seenEtags = []
  let request = 0
  const fetch = async (_url, init) => {
    seenEtags.push(init.headers.get('If-None-Match'))
    request += 1
    if (request === 1) {
      return new Response(JSON.stringify(configuration()), { status: 200, headers: { ETag: '"sha256-one"' } })
    }
    return new Response(null, { status: 304 })
  }
  const client = new FlagStackClient({ baseUrl: 'https://flags.example.test', sdkKey: 'fs_server_id.secret', fetch })
  assert.equal(await client.refresh(), 'updated')
  assert.equal(await client.refresh(), 'not-modified')
  assert.deepEqual(seenEtags, [null, '"sha256-one"'])
  assert.equal(client.getBooleanValue('new-checkout', false), true)
})

test('failed refresh leaves the last known configuration intact', async () => {
  let request = 0
  const fetch = async () => {
    request += 1
    if (request === 1) {
      return new Response(JSON.stringify(configuration()), { status: 200, headers: { ETag: '"sha256-one"' } })
    }
    return new Response('temporarily unavailable', { status: 503 })
  }
  const client = new FlagStackClient({ baseUrl: 'https://flags.example.test', sdkKey: 'fs_client_public', fetch })
  await client.refresh()
  await assert.rejects(client.refresh())
  assert.equal(client.getBooleanValue('new-checkout', false), true)
  assert.equal(client.etag, '"sha256-one"')
})

test('unsupported future schema is rejected without replacing cached configuration', async () => {
  let request = 0
  const fetch = async () => {
    request += 1
    return new Response(JSON.stringify(request === 1 ? configuration() : configuration({ schema_version: 2 })), { status: 200 })
  }
  const client = new FlagStackClient({ baseUrl: 'https://flags.example.test', sdkKey: 'fs_client_public', fetch })
  await client.refresh()
  await assert.rejects(client.refresh(), FlagStackConfigurationError)
  assert.equal(client.getBooleanValue('new-checkout', false), true)
})

test('typed getters use caller fallback for not-ready, missing and type mismatch', async () => {
  const client = new FlagStackClient({
    baseUrl: 'https://flags.example.test',
    sdkKey: 'fs_client_public',
    fetch: async () => new Response(JSON.stringify(configuration()), { status: 200 }),
  })
  assert.equal(client.getBooleanDetails('new-checkout', false).errorCode, 'PROVIDER_NOT_READY')
  await client.refresh()
  assert.equal(client.getBooleanDetails('missing', true).errorCode, 'FLAG_NOT_FOUND')
  const mismatch = client.getStringDetails('new-checkout', 'fallback')
  assert.equal(mismatch.value, 'fallback')
  assert.equal(mismatch.errorCode, 'TYPE_MISMATCH')
})

test('401 responses surface a specific authentication error', async () => {
  const client = new FlagStackClient({
    baseUrl: 'https://flags.example.test',
    sdkKey: 'bad-key',
    fetch: async () => new Response(null, { status: 401 }),
  })
  await assert.rejects(client.refresh(), FlagStackAuthenticationError)
})
