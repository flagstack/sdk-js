# FlagStack JavaScript / TypeScript SDK

Official JavaScript and TypeScript SDKs for [FlagStack](https://github.com/flagstack/flagstack).

> **Status:** Early development. Packages are not yet published for production use.

This repository is a pnpm workspace. `@flagstack/core` owns schema-v1 configuration delivery and local evaluation; runtime and framework packages are intentionally thin integrations over that shared implementation.

## Packages

### `@flagstack/core`

Runtime-neutral configuration and evaluation engine. It provides:

- bearer-authenticated schema-v1 configuration refreshes;
- strong ETag revalidation with `If-None-Match` / `304 Not Modified`;
- retention of the last known-good configuration after refresh failures;
- synchronous local evaluation for boolean, string, number and JSON flags;
- deterministic SHA-256 percentage bucketing compatible with FlagStack's Go evaluator;
- named variants, ordered targeting rules and reusable segments;
- deterministic percentage and multivariate rollouts;
- nested evaluation-context attributes;
- semantic-version, RE2-compatible regex, collection and numeric operators;
- OpenFeature-style resolution reasons and error metadata.

### `@flagstack/browser`

Browser-oriented lifecycle and credential safety around `@flagstack/core`.

It only accepts public FlagStack client SDK keys (`fs_client_...`) and rejects server credentials before any request is made. `createBrowserClient()` performs the initial configuration refresh and starts polling by default.

```ts
import { createBrowserClient } from '@flagstack/browser'

const flags = await createBrowserClient({
  baseUrl: 'https://flags.example.com',
  clientKey: 'fs_client_public-id',
})

const enabled = flags.getBooleanValue('new-checkout', false, {
  targetingKey: 'user-123',
  country: 'GB',
})
```

Pass `autoPoll: false` when an application wants to control refreshes itself. Call `close()` when the client is no longer needed.

Client SDK keys are deliberately public and only receive flags explicitly marked client-visible in FlagStack. Never embed a server SDK key in browser code.

### `@flagstack/node`

Node.js lifecycle and credential safety around `@flagstack/core`.

It requires a secret server SDK key (`fs_server_...`). `createNodeClient()` performs the initial refresh but does not start a background polling interval unless `autoPoll: true` is requested, allowing CLI and serverless processes to exit normally.

```ts
import { createNodeClient } from '@flagstack/node'

const flags = await createNodeClient({
  baseUrl: 'https://flags.example.com',
  serverKey: process.env.FLAGSTACK_SDK_KEY!,
  autoPoll: true,
})

const variant = flags.getStringValue('checkout-layout', 'control', {
  targetingKey: 'user-123',
  plan: 'enterprise',
})
```

Long-running services can enable polling; short-lived processes can call `refresh()` explicitly when needed.

### `@flagstack/react`

Reactive React bindings over `@flagstack/browser`. A `FlagStackProvider` supplies a browser client, while hooks subscribe to configuration changes through React's external-store API and continue to evaluate locally.

```tsx
import { FlagStackProvider, useBooleanFlag } from '@flagstack/react'
import { createBrowserClient } from '@flagstack/browser'

const flags = await createBrowserClient({
  baseUrl: 'https://flags.example.com',
  clientKey: 'fs_client_public-id',
})

function Checkout() {
  const enabled = useBooleanFlag('new-checkout', false, {
    targetingKey: 'user-123',
  })
  return enabled ? <NewCheckout /> : <CurrentCheckout />
}

root.render(
  <FlagStackProvider client={flags}>
    <Checkout />
  </FlagStackProvider>,
)
```

The package also provides typed detail hooks, `useFlagStackReady()`, `useFlagStackConfiguration()` and `useFlagStackClient()`.

### `@flagstack/next`

App Router integration with explicit server and client entry points.

Server Components use `@flagstack/next/server`. `createNextFlagStack()` wraps the Node SDK in React `cache()`, so components in one server render share the same loaded FlagStack snapshot while separate requests remain isolated.

```ts
import { createNextFlagStack } from '@flagstack/next/server'

export const flagstack = createNextFlagStack({
  baseUrl: process.env.FLAGSTACK_URL!,
  serverKey: process.env.FLAGSTACK_SDK_KEY!,
})
```

```tsx
import { flagstack } from '@/lib/flagstack'

export default async function Page() {
  const flags = await flagstack.getClient()
  const enabled = flags.getBooleanValue('new-checkout', false, {
    targetingKey: 'user-123',
  })
  return enabled ? <NewCheckout /> : <CurrentCheckout />
}
```

Client Components import from `@flagstack/next/client`, which is a `'use client'` entry exposing the React/browser provider and hooks. The server SDK key is never part of that client module graph.

## Core usage

Applications that need complete lifecycle control can use `@flagstack/core` directly:

```ts
import { FlagStackClient } from '@flagstack/core'

const flags = new FlagStackClient({
  baseUrl: 'https://flags.example.com',
  sdkKey: process.env.FLAGSTACK_SDK_KEY!,
})

await flags.refresh()
```

`refresh()` only replaces in-memory state after the downloaded document passes schema and evaluator validation. A later refresh failure does not erase the last valid configuration.

## Planned package

```text
@flagstack/openfeature
```

Framework packages build on the runtime/core packages rather than implementing separate targeting or rollout semantics.

## Development

```bash
corepack enable
pnpm install
pnpm test
```

CI builds and tests all current packages on Node.js 22 and 24.

## Contributing

Organisation-wide contribution guidelines are maintained in [`flagstack/.github`](https://github.com/flagstack/.github). FlagStack uses a linear Git history and integrates pull requests by rebase only.

## Related repositories

- [FlagStack](https://github.com/flagstack/flagstack)
- [Python SDK](https://github.com/flagstack/sdk-python)
- [Go SDK](https://github.com/flagstack/sdk-go)
- [.NET SDK](https://github.com/flagstack/sdk-dotnet)

## Licence

This SDK is licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE).
