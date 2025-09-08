/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RuntimeException } from '@poppinss/utils/exception'
import type { RedisConnectionsList } from './types.ts'

/**
 * Define config for redis
 *
 * @param config - Redis configuration object
 *
 * @example
 * ```ts
 * export default defineConfig({
 *   connection: 'main',
 *   connections: {
 *     main: {
 *       host: 'localhost',
 *       port: 6379,
 *       password: 'secret'
 *     },
 *     cache: {
 *       host: 'redis-cache.example.com',
 *       port: 6379
 *     }
 *   }
 * })
 * ```
 */
export function defineConfig<Connections extends RedisConnectionsList>(config: {
  connection: keyof Connections
  connections: Connections
}): {
  connection: keyof Connections
  connections: Connections
} {
  if (!config) {
    throw new RuntimeException('Invalid config. It must be an object')
  }

  if (!config.connections) {
    throw new RuntimeException('Missing "connections" property in the redis config file')
  }

  if (!config.connection) {
    throw new RuntimeException(
      'Missing "connection" property in redis config. Specify a default connection to use'
    )
  }

  if (!config.connections[config.connection]) {
    throw new RuntimeException(
      `Missing "connections.${String(
        config.connection
      )}". It is referenced by the "default" redis connection`
    )
  }

  return config
}
