import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BrowserSwitchOnYourCodeClient } from '@switchonyourcode/browser'
import {
  SwitchOnYourCodeProvider,
  useBooleanFlag,
  useSwitchOnYourCodeReady,
} from '../dist/index.js'

function configuration() {
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
    ],
    segments: [],
  }
}

test('React hooks evaluate through the provided browser client', async () => {
  const client = new BrowserSwitchOnYourCodeClient({
    baseUrl: 'https://flags.example.com',
    clientKey: 'syoc_client_test',
    autoPoll: false,
    fetch: async () => new Response(JSON.stringify(configuration()), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ETag: '"config-1"' },
    }),
  })
  await client.refresh()

  function FlagValue() {
    const ready = useSwitchOnYourCodeReady()
    const enabled = useBooleanFlag('new-checkout', false)
    return createElement('span', null, `${ready}:${enabled}`)
  }

  const html = renderToStaticMarkup(
    createElement(SwitchOnYourCodeProvider, { client }, createElement(FlagValue)),
  )
  assert.equal(html, '<span>true:true</span>')
})

test('React hooks require a provider', () => {
  function FlagValue() {
    useBooleanFlag('new-checkout', false)
    return null
  }

  assert.throws(
    () => renderToStaticMarkup(createElement(FlagValue)),
    /SwitchOnYourCodeProvider/,
  )
})
