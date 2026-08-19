# FlagStack JavaScript / TypeScript SDK

Official JavaScript and TypeScript SDKs for [FlagStack](https://github.com/flagstack/flagstack).

> **Status:** Planned / early development. Not yet ready for production use.

This repository is intended to be a monorepo containing the shared JavaScript/TypeScript SDK core and framework-specific integrations.

## Planned packages

The exact package structure is still subject to design, but is expected to include packages such as:

```text
@flagstack/core
@flagstack/browser
@flagstack/node
@flagstack/react
@flagstack/next
@flagstack/openfeature
```

## Goals

- Full TypeScript type safety.
- JavaScript compatibility.
- Node.js support.
- Browser-side feature evaluation.
- First-class React integration.
- First-class Next.js App Router support.
- Server Components and server-side evaluation where appropriate.
- Client-side hooks and hydration support.
- Real-time flag updates.
- Local evaluation and resilient cached configuration.
- OpenFeature integration.

## Repository structure

The repository is expected to use a workspace-based monorepo so that framework integrations can share the same core implementation and release tooling.

## Contributing

Organisation-wide contribution guidelines are maintained in [`flagstack/.github`](https://github.com/flagstack/.github). FlagStack uses a linear Git history and integrates pull requests by rebase only.

## Related repositories

- [FlagStack](https://github.com/flagstack/flagstack)
- [Python SDK](https://github.com/flagstack/sdk-python)
- [Go SDK](https://github.com/flagstack/sdk-go)
- [.NET SDK](https://github.com/flagstack/sdk-dotnet)

## Licence

This SDK is licensed under the **Apache License 2.0**. See [`LICENSE`](LICENSE).
