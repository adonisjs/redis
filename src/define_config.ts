/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { RuntimeException } from '@poppinss/utils'
import type { RedisConnectionsList } from './types.js'

/**
 * Define config for redis
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
