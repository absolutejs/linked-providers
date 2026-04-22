# @absolutejs/linked-providers

Shared linked-provider credential and resolver contracts for AbsoluteJS packages.

This package is intentionally narrow. It provides:

- linked provider grant and binding types
- resolved credential and token lease types
- generic linked-provider resolver contracts
- durable store contracts for grants and bindings

It does not provide:

- OAuth routes
- token refresh implementations
- provider SDK clients
- RAG or connector runtime code

That split is intentional:

- `@absolutejs/auth` implements these contracts
- `@absolutejs/absolute` consumes these contracts
- this package stays the neutral source of truth between them
