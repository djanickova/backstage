/*
 * Copyright 2026 The Backstage Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  mockServices,
  registerMswTestHooks,
} from '@backstage/backend-test-utils';
import { ConfigReader } from '@backstage/config';
import { setupServer } from 'msw/node';
import { HttpResponse, http } from 'msw';
import { VaultSecretProvider } from './VaultSecretProvider';

const logger = mockServices.logger.mock();

describe('VaultSecretProvider', () => {
  const worker = setupServer();
  registerMswTestHooks(worker);

  const baseUrl = 'http://vault.test:8200';

  const createProvider = (overrides?: Record<string, string>) => {
    const config = new ConfigReader({
      baseUrl,
      token: 'test-token',
      secretEngine: 'secret',
      ...overrides,
    });
    return VaultSecretProvider.fromConfig(config, { logger });
  };

  it('should resolve a secret from Vault successfully', async () => {
    worker.use(
      http.get(`${baseUrl}/v1/secret/data/ci/github`, ({ request }) => {
        expect(request.headers.get('X-Vault-Token')).toBe('test-token');
        return HttpResponse.json({
          data: { data: { token: 'ghp_secret123' } },
        });
      }),
    );

    const provider = createProvider();
    const result = await provider.resolveSecret({
      name: 'GITHUB_TOKEN',
      config: { path: 'ci/github', key: 'token' },
    });

    expect(result).toBe('ghp_secret123');
  });

  it('should use the default secret engine when not configured', async () => {
    worker.use(
      http.get(`${baseUrl}/v1/secret/data/ci/github`, () => {
        return HttpResponse.json({
          data: { data: { token: 'ghp_default_engine' } },
        });
      }),
    );

    const config = new ConfigReader({ baseUrl, token: 'test-token' });
    const provider = VaultSecretProvider.fromConfig(config, { logger });
    const result = await provider.resolveSecret({
      name: 'GITHUB_TOKEN',
      config: { path: 'ci/github', key: 'token' },
    });

    expect(result).toBe('ghp_default_engine');
  });

  it('should use a custom secret engine mount path', async () => {
    worker.use(
      http.get(`${baseUrl}/v1/kv/data/ci/github`, () => {
        return HttpResponse.json({
          data: { data: { token: 'ghp_custom_engine' } },
        });
      }),
    );

    const provider = createProvider({ secretEngine: 'kv' });
    const result = await provider.resolveSecret({
      name: 'GITHUB_TOKEN',
      config: { path: 'ci/github', key: 'token' },
    });

    expect(result).toBe('ghp_custom_engine');
  });

  it('should throw when the key is not found in Vault response data', async () => {
    worker.use(
      http.get(`${baseUrl}/v1/secret/data/ci/github`, () => {
        return HttpResponse.json({
          data: { data: { other_key: 'some_value' } },
        });
      }),
    );

    const provider = createProvider();
    await expect(
      provider.resolveSecret({
        name: 'GITHUB_TOKEN',
        config: { path: 'ci/github', key: 'token' },
      }),
    ).rejects.toThrow("Key 'token' not found in Vault secret at 'ci/github'");
  });

  it('should throw when path is missing from per-secret config', async () => {
    const provider = createProvider();
    await expect(
      provider.resolveSecret({
        name: 'GITHUB_TOKEN',
        config: { key: 'token' },
      }),
    ).rejects.toThrow(
      "Secret 'GITHUB_TOKEN' is missing required 'path' in its provider config",
    );
  });

  it('should throw when key is missing from per-secret config', async () => {
    const provider = createProvider();
    await expect(
      provider.resolveSecret({
        name: 'GITHUB_TOKEN',
        config: { path: 'ci/github' },
      }),
    ).rejects.toThrow(
      "Secret 'GITHUB_TOKEN' is missing required 'key' in its provider config",
    );
  });

  it('should throw on Vault 403 permission denied', async () => {
    worker.use(
      http.get(`${baseUrl}/v1/secret/data/ci/github`, () => {
        return new HttpResponse(null, {
          status: 403,
          statusText: 'Forbidden',
        });
      }),
    );

    const provider = createProvider();
    await expect(
      provider.resolveSecret({
        name: 'GITHUB_TOKEN',
        config: { path: 'ci/github', key: 'token' },
      }),
    ).rejects.toThrow(
      "Failed to read secret 'GITHUB_TOKEN' from Vault: 403 Forbidden",
    );
  });

  it('should throw on Vault 404 secret not found', async () => {
    worker.use(
      http.get(`${baseUrl}/v1/secret/data/ci/github`, () => {
        return new HttpResponse(null, {
          status: 404,
          statusText: 'Not Found',
        });
      }),
    );

    const provider = createProvider();
    await expect(
      provider.resolveSecret({
        name: 'GITHUB_TOKEN',
        config: { path: 'ci/github', key: 'token' },
      }),
    ).rejects.toThrow(
      "Failed to read secret 'GITHUB_TOKEN' from Vault: 404 Not Found",
    );
  });
});
