# FlagStack JavaScript / TypeScript SDK

Official JavaScript and TypeScript SDKs for [FlagStack](https://github.com/flagstack/flagstack).

> **Status:** Early development. The core package is not yet published for production use.

This repository is a pnpm workspace. The shared `@flagstack/core` package owns the schema-v1 configuration client and the local evaluator used by future browser, Node.js, React, Next.js and OpenFeature integrations.

## Current package

### `@flagstack/core`

The core package is runtime-neutral and has no runtime dependencies. It supports Node.js 22+ and browser environments with standard `fetch`, `Headers`, `TextEncoder`, timers and typed arrays.

It provides:

- bearer-authenticated schema-v1 configuration refreshes;
- strong ETag revalidation with `If-None-Match` / `304 Not Modified`;
- retention of the last known-good configuration after refresh failures;
- synchronous local flag evaluation;
- deterministic SHA-256 percentage bucketing compatible with FlagStack's Go reference evaluator;
- boolean, string, number and JSON flags;
- named variants, ordered targeting rules and reusable segments;
- deterministic percentage and multivariate rollouts;
- nested evaluation-context attributes;
- semantic-version, regex, collection and numeric operators;
- OpenFeature-style resolution reasons and error metadata;
- typed fallback behaviour when configuration is not ready, a flag is absent or a getter uses the wrong flag kind.

## Basic usage

```ts
import { FlagStackClient } from '@flagstack/core'

const flags = new FlagStackClient({
  baseUrl: 'https://flags.example.com',
  sdkKey: process.env.FLAGSTACK_SDK_KEY!,
})

await flags.refresh()
flags.startPolling()

const enabled = flags.getBooleanValue('new-checkout', false, {
  targetingKey: 'user-123',
  country: 'GB',
  plan: 'enterprise',
})
```

`refresh()` only replaces the in-memory configuration after the downloaded document passes schema and evaluator validation. If a later refresh fails, existing local evaluations continue using the last valid document.

Polling is opt-in in `@flagstack/core`; runtime-specific packages can choose more opinionated lifecycle defaults later.

## Browser credentials

Browser/mobile applications must use a FlagStack **client SDK key** (`fs_client_...`). Client keys are deliberately public and only receive flags explicitly marked client-visible in FlagStack.

Never embed a server SDK key (`fs_server_...`) in browser code.

## Planned packages

```text
@flagstack/core
@flagstack/browser
@flagstack/node
@flagstack/react
@flagstack/next
@flagstack/openfeature
```

Framework packages will build on `@flagstack/core`; they must not implement separate targeting or rollout semantics.

## Development

```bash
corepack enable
pnpm install
pnpm test
```

CI builds and tests the core package on Node.js 22 and 24.

## Contributing

Organisation-wide contribution guidelines are maintained in [`flagstack/.github`](https://github.com/flagstack/.github). FlagStack uses a linear Git history and integrates pull requests by rebase only.

## Related repositories

- [FlagStack](https://github.com/flagstack/flagstack)
- [Python SDK](https://github.com/flagstack/sdk-python)
- [Go SDK](https://github.com/flagstack/sdk-go)
- [.NET SDK](https://github.com/flagstack/sdk-dotnet)

## Licence

This SDK is licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE).
