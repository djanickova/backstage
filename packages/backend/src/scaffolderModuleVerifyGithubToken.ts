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

import { createBackendModule } from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';

export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'verify-github-token',
  register({ registerInit }) {
    registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
      },
      async init({ scaffolder }) {
        scaffolder.addActions(
          createTemplateAction({
            id: 'debug:verify-github-token',
            description:
              'Calls the GitHub API with a token to verify it is valid. Logs the authenticated username.',
            schema: {
              input: {
                token: z => z.string({ description: 'GitHub token to verify' }),
              },
              output: {
                username: z =>
                  z
                    .string({ description: 'Authenticated GitHub username' })
                    .optional(),
                authenticated: z =>
                  z.boolean({
                    description: 'Whether the token authenticated successfully',
                  }),
              },
            },
            async handler(ctx) {
              ctx.logger.info(
                'Calling GitHub API /user to verify token is real...',
              );

              const response = await fetch('https://api.github.com/user', {
                headers: {
                  Authorization: `Bearer ${ctx.input.token}`,
                  Accept: 'application/vnd.github+json',
                },
              });

              if (!response.ok) {
                ctx.logger.error(
                  `GitHub API returned ${response.status} ${response.statusText}`,
                );
                ctx.output('authenticated', false);
                return;
              }

              const user = (await response.json()) as { login: string };
              ctx.logger.info(
                `Token is valid! Authenticated as GitHub user: ${user.login}`,
              );
              ctx.output('username', user.login);
              ctx.output('authenticated', true);
            },
          }),
        );
      },
    });
  },
});
