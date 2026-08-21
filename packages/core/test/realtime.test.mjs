import assert from 'node:assert/strict'
import test from 'node:test'

import {
  SwitchOnYourCodeAuthenticationError,
  SwitchOnYourCodeRealtimeStream,
} from '../dist/index.js'

const encoder = new TextEncoder()

function eventResponse(body) {
  return new Response(
    new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(body))
        controller.close()
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

function liveEventResponse(body, signal, captureController) {
  return new Response(
    new ReadableStream({
      start(controller) {
        let closed = false
        const close = () => {
          if (!closed) {
            closed = true
            controller.close()
          }
        }
        captureController(controller)
        controller.enqueue(encoder.encode(body))
        signal?.addEventListener('abort', close, { once: true })
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  )
}

async function waitFor(predicate, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error('Timed out waiting for realtime condition.')
    }
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
}

test('realtime stream sends bearer authentication and reconnects after an ended stream', async () => {
  let requests = 0
  const stream = new SwitchOnYourCodeRealtimeStream({
    baseUrl: 'https://flags.example.test/',
    sdkKey: 'syoc_server_credential.secret',
    reconnectDelayMs: 1,
    onConfigurationChanged: () => {},
    onError: (error) => {
      throw error
    },
    fetch: async (input, init) => {
      requests += 1
      assert.equal(String(input), 'https://flags.example.test/sdk/v1/events')
      const headers = new Headers(init?.headers)
      assert.equal(headers.get('Accept'), 'text/event-stream')
      assert.equal(headers.get('Authorization'), 'Bearer syoc_server_credential.secret')
      return eventResponse('event: ready\ndata: {"schema_version":1,"environment_id":"env-1"}\n\n')
    },
  })

  stream.start()
  await waitFor(() => requests >= 2)
  stream.stop()
  await waitFor(() => !stream.running)
})

test('configuration_changed events are coalesced while a refresh is in flight', async () => {
  let eventController
  let refreshes = 0
  let releaseRefresh
  const refreshGate = new Promise((resolve) => {
    releaseRefresh = resolve
  })

  const stream = new SwitchOnYourCodeRealtimeStream({
    baseUrl: 'https://flags.example.test',
    sdkKey: 'syoc_client_public',
    onConfigurationChanged: async () => {
      refreshes += 1
      if (refreshes === 1) {
        await refreshGate
      }
    },
    onError: (error) => {
      throw error
    },
    fetch: async (_input, init) => liveEventResponse(
      'retry: 5000\nevent: ready\ndata: {}\n\n',
      init?.signal,
      (controller) => {
        eventController = controller
      },
    ),
  })

  stream.start()
  await waitFor(() => eventController !== undefined)
  eventController.enqueue(encoder.encode('event: configuration_changed\ndata: {}\n\n'))
  await waitFor(() => refreshes === 1)
  eventController.enqueue(encoder.encode('event: configuration_changed\ndata: {}\n\nevent: configuration_changed\ndata: {}\n\n'))
  releaseRefresh()
  await waitFor(() => refreshes === 2)
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(refreshes, 2)
  stream.stop()
  await waitFor(() => !stream.running)
})

test('credential_revoked is terminal and surfaces an authentication error', async () => {
  let seenError
  const stream = new SwitchOnYourCodeRealtimeStream({
    baseUrl: 'https://flags.example.test',
    sdkKey: 'syoc_client_public',
    onConfigurationChanged: () => {},
    onError: (error) => {
      seenError = error
    },
    fetch: async () => eventResponse('event: credential_revoked\ndata: {"environment_id":"env-1"}\n\n'),
  })

  stream.start()
  await waitFor(() => seenError !== undefined)
  await waitFor(() => !stream.running)
  assert.ok(seenError instanceof SwitchOnYourCodeAuthenticationError)
  assert.match(seenError.message, /revoked/)
})
