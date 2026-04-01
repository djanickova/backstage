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

import { Config } from '@backstage/config';
import { InputError } from '@backstage/errors';
import { LoggerService } from '@backstage/backend-plugin-api';
import { JsonObject } from '@backstage/types';
import { ScaffolderSecretProvider } from '@backstage/plugin-scaffolder-node/alpha';

/**
 * A secret provider that resolves secrets from HashiCorp Vault using the KV v2 engine.
 *
 * @public
 */
export class VaultSecretProvider implements ScaffolderSecretProvider {
  private constructor(
    private readonly baseUrl: string,
    private readonly token: string,
    private readonly secretEngine: string,
    private readonly logger: LoggerService,
  ) {}

  static fromConfig(
    config: Config,
    options: { logger: LoggerService },
  ): VaultSecretProvider {
    const baseUrl = config.getString('baseUrl');
    const token = config.getString('token');
    const secretEngine = config.getOptionalString('secretEngine') ?? 'secret';

    return new VaultSecretProvider(
      baseUrl,
      token,
      secretEngine,
      options.logger,
    );
  }

  async resolveSecret(options: {
    name: string;
    config: JsonObject;
  }): Promise<string> {
    const { name, config } = options;
    const path = config.path;
    const key = config.key;

    if (!path || typeof path !== 'string') {
      throw new InputError(
        `Secret '${name}' is missing required 'path' in its provider config`,
      );
    }
    if (!key || typeof key !== 'string') {
      throw new InputError(
        `Secret '${name}' is missing required 'key' in its provider config`,
      );
    }

    const url = `${this.baseUrl}/v1/${this.secretEngine}/data/${path}`;

    this.logger.debug(`Resolving secret '${name}' from Vault at ${url}`);

    const response = await fetch(url, {
      headers: { 'X-Vault-Token': this.token },
    });

    if (!response.ok) {
      throw new InputError(
        `Failed to read secret '${name}' from Vault: ${response.status} ${response.statusText}`,
      );
    }

    const body = await response.json();
    const value = body?.data?.data?.[key];

    if (value === undefined) {
      throw new InputError(
        `Key '${key}' not found in Vault secret at '${path}'`,
      );
    }

    return String(value);
  }
}
