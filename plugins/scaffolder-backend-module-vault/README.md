# @backstage/plugin-scaffolder-backend-module-vault

The Vault secret provider module for [@backstage/plugin-scaffolder-backend](https://www.npmjs.com/package/@backstage/plugin-scaffolder-backend).

This module adds support for resolving scaffolder template secrets from [HashiCorp Vault](https://www.vaultproject.io/).

## Installation

Add the module to your backend:

```ts
// packages/backend/src/index.ts
backend.add(import('@backstage/plugin-scaffolder-backend-module-vault'));
```

## Configuration

```yaml
scaffolder:
  secretProviders:
    vault:
      baseUrl: https://vault.example.com
      token: ${VAULT_TOKEN}

  defaultEnvironment:
    secrets:
      GITHUB_TOKEN:
        provider: vault
        path: ci/github
        key: token
```

The `token` field supports Backstage config environment variable substitution (`${VAULT_TOKEN}`), so the actual value is injected at deploy time and never hardcoded.
