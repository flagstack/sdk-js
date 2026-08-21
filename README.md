# Switch On Your Code JavaScript / TypeScript SDK

Official JavaScript and TypeScript SDKs for [Switch On Your Code](https://github.com/switchonyourcode/switchonyourcode).

> **Status:** Early development. Packages are not yet published for production use.

This repository is a pnpm workspace. `@switchonyourcode/core` owns schema-v1 configuration delivery and local evaluation; runtime and framework packages are intentionally thin integrations over that shared implementation.

## Packages

### `@switchonyourcode/core`

Runtime-neutral configuration and evaluation engine. It provides:

- bearer-authenticated schema-v1 configuration refreshes;
- strong ETag revalidation with `If-None-Match` / `304 Not Modified`;
- authenticated Server-Sent Events (SSE) invalidation support through `/sdk/v1/events`;
- automatic SSE reconnects, server retry-hint handling and terminal credential-revocation handling;
- retention of the last known-good configuration after refresh failures;
- synchronous local evaluation for boolean, string, number and JSON flags;
- deterministic SHA-256 percentage bucketing compatible with Switch On Your Code's Go evaluator;
- named variants, ordered targeting rules and reusable segments;
- deterministic percentage and multivariate rollouts;
- nested evaluation-context attributes;
- semantic-version, RE2-compatible regex, collection and numeric operators;
- OpenFeature-style resolution reasons and error metadata.

Realtime events are invalidation signals only. A `configuration_changed` event triggers the same ETag-aware `/sdk/v1/config` refresh path used by polling; configuration documents are not sent over SSE. This keeps one authoritative configuration-delivery contract while allowing near-immediate updates.

### `@switchonyourcode/browser`

Browser-oriented lifecycle and credential safety around `@switchonyourcode/core`.

It only accepts public Switch On Your Code client SDK keys (`syoc_client_...`) and rejects server credentials before any request is made. `createBrowserClient()` performs the initial configuration refresh, starts the authenticated SSE stream by default, and retains a five-minute polling interval as a safety net.

```ts
import { createBrowserClient } from '@switchonyourcode/browser'

const flags = await createBrowserClient({
  baseUrl: 'https://flags.example.com',
  clientKey: 'syoc_client_public-id',
})

const enabled = flags.getBooleanValue('new-checkout', false, {
  targetingKey: 'user-123',
  country: 'GB',
})
```

The browser SDK uses streaming `fetch` rather than native `EventSource`, because the Switch On Your Code event endpoint requires a bearer `Authorization` header. No additional realtime dependency is required.

Use `autoRealtime: false` to disable SSE, `autoPoll: false` to disable the fallback poll, or `pollIntervalMs` to change its interval. `realtimeReconnectDelayMs` controls the initial reconnect delay; the SDK subsequently honours valid `retry` hints sent by the server. `startRealtime()` and `stopRealtime()` are also available for explicit lifecycle control. Call `close()` when the client is no longer needed; it stops both realtime delivery and polling.

Client SDK keys are deliberately public and only receive flags explicitly marked client-visible in Switch On Your Code. Never embed a server SDK key in browser code.

### `@switchonyourcode/node`

Node.js lifecycle and credential safety around `@switchonyourcode/core`.

It requires a secret server SDK key (`syoc_server_...`). `createNodeClient()` performs the initial refresh but does not start background realtime delivery or polling by default, allowing CLI and serverless processes to exit normally.

Long-running services can opt into realtime invalidation:

```ts
import { createNodeClient } from '@switchonyourcode/node'

const flags = await createNodeClient({
  baseUrl: 'https://flags.example.com',
  serverKey: process.env.SWITCHONYOURCODE_SDK_KEY!,
  autoRealtime: true,
})

const variant = flags.getStringValue('checkout-layout', 'control', {
  targetingKey: 'user-123',
  plan: 'enterprise',
})
```

With `autoRealtime: true`, the Node SDK also enables a five-minute polling safety net unless `autoPoll: false` is explicitly supplied. Applications can instead use `startRealtime()` / `stopRealtime()`, polling alone, or explicit `refresh()` calls. `close()` stops all background activity.

### `@switchonyourcode/react`

Reactive React bindings over `@switchonyourcode/browser`. A `SwitchOnYourCodeProvider` supplies a browser client, while hooks subscribe to configuration changes through React's external-store API and continue to evaluate locally. Because the browser client uses realtime invalidation by default, React consumers update when refreshed configuration arrives without adding another realtime layer.

```tsx
import { SwitchOnYourCodeProvider, useBooleanFlag } from '@switchonyourcode/react'
import { createBrowserClient } from '@switchonyourcode/browser'

const flags = await createBrowserClient({
  baseUrl: 'https://flags.example.com',
  clientKey: 'syoc_client_public-id',
})

function Checkout() {
  const enabled = useBooleanFlag('new-checkout', false, {
    targetingKey: 'user-123',
  })
  return enabled ? <NewCheckout /> : <CurrentCheckout />
}

root.render(
  <SwitchOnYourCodeProvider client={flags}>
    <Checkout />
  </SwitchOnYourCodeProvider>,
)
```

The package also provides typed detail hooks, `useSwitchOnYourCodeReady()`, `useSwitchOnYourCodeConfiguration()` and `useSwitchOnYourCodeClient()`.

### `@switchonyourcode/next`

App Router integration with explicit server and client entry points.

Server Components use `@switchonyourcode/next/server`. `createNextSwitchOnYourCode()` wraps the Node SDK in React `cache()`, so components in one server render share the same loaded Switch On Your Code snapshot while separate requests remain isolated.

```ts
import { createNextSwitchOnYourCode } from '@switchonyourcode/next/server'

export const switchonyourcode = createNextSwitchOnYourCode({
  baseUrl: process.env.SWITCHONYOURCODE_URL!,
  serverKey: process.env.SWITCHONYOURCODE_SDK_KEY!,
})
```

```tsx
import { switchonyourcode } from '@/lib/switchonyourcode'

export default async function Page() {
  const flags = await switchonyourcode.getClient()
  const enabled = flags.getBooleanValue('new-checkout', false, {
    targetingKey: 'user-123',
  })
  return enabled ? <NewCheckout /> : <CurrentCheckout />
}
```

Client Components import from `@switchonyourcode/next/client`, which is a `'use client'` entry exposing the React/browser provider and hooks. The server SDK key is never part of that client module graph.

### `@switchonyourcode/openfeature`

OpenFeature provider adapters that preserve Switch On Your Code's local evaluation semantics while allowing applications to use the vendor-neutral OpenFeature API.

Server applications use the secret Node SDK through `@switchonyourcode/openfeature/server`:

```ts
import { OpenFeature } from '@openfeature/server-sdk'
import { SwitchOnYourCodeServerProvider } from '@switchonyourcode/openfeature/server'

await OpenFeature.setProviderAndWait(
  new SwitchOnYourCodeServerProvider({
    baseUrl: 'https://flags.example.com',
    serverKey: process.env.SWITCHONYOURCODE_SDK_KEY!,
    autoRealtime: true,
  }),
)

const client = OpenFeature.getClient()
const enabled = await client.getBooleanValue('new-checkout', false, {
  targetingKey: 'user-123',
  plan: 'enterprise',
})
```

Browser applications use the public client SDK through `@switchonyourcode/openfeature/client`:

```ts
import { OpenFeature } from '@openfeature/web-sdk'
import { SwitchOnYourCodeClientProvider } from '@switchonyourcode/openfeature/client'

await OpenFeature.setProviderAndWait(
  new SwitchOnYourCodeClientProvider({
    baseUrl: 'https://flags.example.com',
    clientKey: 'syoc_client_public-id',
  }),
)

await OpenFeature.setContext({
  targetingKey: 'user-123',
  country: 'GB',
})
```

The adapters:

- implement the current OpenFeature server and web provider interfaces;
- map Switch On Your Code resolution reasons and error codes to OpenFeature resolution details;
- expose environment, revision, enabled state and matched rule ID as OpenFeature flag metadata;
- normalize OpenFeature `Date` context values to ISO-8601 strings before local Switch On Your Code evaluation;
- emit `PROVIDER_CONFIGURATION_CHANGED` after refreshed configuration changes;
- keep server and browser provider entry points separate so server credentials and dependencies cannot enter a browser bundle accidentally.

The server provider follows `@switchonyourcode/node` lifecycle defaults, so realtime delivery remains opt-in. The client provider follows `@switchonyourcode/browser`, so realtime invalidation and the slow polling safety net are enabled by default.

## Realtime invalidation

The runtime packages consume Switch On Your Code's authenticated SSE endpoint:

```text
GET /sdk/v1/events
Authorization: Bearer <SDK key>
Accept: text/event-stream
```

The server sends `ready`, `configuration_changed` and terminal `credential_revoked` events, plus periodic keepalive comments. On `configuration_changed`, the SDK does not trust or install data from the event itself. It calls `/sdk/v1/config` with the cached ETag and either receives `304 Not Modified` or validates and atomically installs a new schema-v1 document.

Transient stream closure causes an automatic reconnect. Multiple invalidations arriving while a configuration refresh is already running are coalesced into at most one follow-up refresh. This avoids concurrent refresh storms while ensuring an update that arrives during a fetch is not lost.

Polling remains available as a recovery path for networks or proxies that do not preserve long-lived event streams.

## Core usage

Applications that need complete lifecycle control can use `@switchonyourcode/core` directly:

```ts
import {
  SwitchOnYourCodeClient,
  SwitchOnYourCodeRealtimeStream,
} from '@switchonyourcode/core'

const flags = new SwitchOnYourCodeClient({
  baseUrl: 'https://flags.example.com',
  sdkKey: process.env.SWITCHONYOURCODE_SDK_KEY!,
})

await flags.refresh()

const realtime = new SwitchOnYourCodeRealtimeStream({
  baseUrl: 'https://flags.example.com',
  sdkKey: process.env.SWITCHONYOURCODE_SDK_KEY!,
  fetch,
  onConfigurationChanged: async () => {
    await flags.refresh()
  },
  onError: console.error,
})
realtime.start()
```

`refresh()` only replaces in-memory state after the downloaded document passes schema and evaluator validation. A later refresh failure does not erase the last valid configuration.

Framework and interoperability packages build on the runtime/core packages rather than implementing separate targeting or rollout semantics.

## Development

```bash
corepack enable
pnpm install
pnpm test
```

CI builds and tests all current packages on Node.js 22 and 24.

## Contributing

Organisation-wide contribution guidelines are maintained in [`switchonyourcode/.github`](https://github.com/switchonyourcode/.github). Switch On Your Code uses a linear Git history and integrates pull requests by rebase only.

## Related repositories

- [Switch On Your Code](https://github.com/switchonyourcode/switchonyourcode)
- [Python SDK](https://github.com/switchonyourcode/sdk-python)
- [Go SDK](https://github.com/switchonyourcode/sdk-go)
- [.NET SDK](https://github.com/switchonyourcode/sdk-dotnet)

## Licence

This SDK is licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE).
