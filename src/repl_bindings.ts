/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Repl } from '@adonisjs/core/repl'
import type { ApplicationService } from '@adonisjs/core/types'

/**
 * Define repl bindings. The method must be invoked when application environment
 * is set to repl.
 */
export function defineReplBindings(app: ApplicationService, repl: Repl) {
  repl.addMethod(
    'loadRedis',
    async () => {
      repl.server!.context.redis = await app.container.make('redis')
      repl.notify(
        `Loaded "redis" service. You can access it using the "${repl.colors.underline(
          'redis',
        )}" variable`,
      )
    },
    { description: 'Load "redis" service in the REPL context' },
  )
}
