import assert from 'node:assert/strict'
import test from 'node:test'

import { BrowserSwitchOnYourCodeClient, createBrowserClient } from '../dist/index.js'

function configuration(enabled = true) {
  return {
    schema_version: 1,
    environment: { id: 'env-1', key: 'production' },
    flags: [
      {
        id: 'flag-1',
        key: 'new-checkout',
        kind: 'boolean',
        default_value: false,
        enabled,
        variants: [],
        policy: {},
        revision: enabled ? 2 : 1,
      },
    ],
    segments: [],
  }
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for browser realtime condition.')
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

test('browser client refuses secret server SDK keys', () => {
  assert.throws(
    () => new BrowserSwitchOnYourCodeClient({ baseUrl: 'https://flags.example.com', clientKey: 'syoc_server_secret.value' }),
    /requires a Switch On Your Code client key/,
  )
})

test('browser initializer loads configuration and evaluates locally', async () => {
  let requests = 0
  const client = await createBrowserClient({
    baseUrl: 'https://flags.example.com/',
    clientKey: 'syoc_client_public-id',
    autoPoll: false,
    autoRealtime: false,
    fetch: async (input, init) => {
      requests += 1
      assert.equal(String(input), 'https://flags.example.com/sdk/v1/config')
      assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer syoc_client_public-id')
      return new Response(JSON.stringify(configuration()), {
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

test('browser realtime invalidation refreshes configuration through the ETag path', async () => {
  const encoder = new TextEncoder()
  let eventController
  let configRequests = 0
  const seenEtags = []

  const client = await createBrowserClient({
    baseUrl: 'https://flags.example.com',
    clientKey: 'syoc_client_public-id',
    autoPoll: false,
    fetch: async (input, init) => {
      const url = String(input)
      const headers = new Headers(init?.headers)
      if (url.endsWith('/sdk/v1/events')) {
        assert.equal(headers.get('Authorization'), 'Bearer syoc_client_public-id')
        assert.equal(headers.get('Accept'), 'text/event-stream')
        return new Response(
          new ReadableStream({
            start(controller) {
              eventController = controller
              controller.enqueue(encoder.encode('retry: 5000\nevent: ready\ndata: {"schema_version":1,"environment_id":"env-1"}\n\n'))
            },
          }),
          { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
        )
      }

      assert.equal(url, 'https://flags.example.com/sdk/v1/config')
      seenEtags.push(headers.get('If-None-Match'))
      configRequests += 1
      const enabled = configRequests > 1
      return new Response(JSON.stringify(configuration(enabled)), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ETag: enabled ? '"browser-v2"' : '"browser-v1"' },
      })
    },
  })

  assert.equal(client.getBooleanValue('new-checkout', true), false)
  await waitFor(() => eventController !== undefined)
  eventController.enqueue(encoder.encode('event: configuration_changed\ndata: {"environment_id":"env-1"}\n\n'))
  await waitFor(() => configRequests === 2)

  assert.deepEqual(seenEtags, [null, '"browser-v1"'])
  assert.equal(client.etag, '"browser-v2"')
  assert.equal(client.getBooleanValue('new-checkout', false), true)
  client.close()
  await waitFor(() => !client.realtimeRunning)
})
