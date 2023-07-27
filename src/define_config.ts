/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { InvalidArgumentsException } from '@poppinss/utils'
import type { RedisConnectionsList } from './types/main.js'

/**
 * Expected shape of the config accepted by the "defineConfig"
 * method
 */
type RedisConfig = {
  connections: RedisConnectionsList
}

/**
 * Define config for redis
 */
export function defineConfig<T extends RedisConfig & { connection: keyof T['connections'] }>(
  config: T
): T {
  if (!config) {
    throw new InvalidArgumentsException('Invalid config. It must be a valid object')
  }

  if (!config.connections) {
    throw new InvalidArgumentsException('Invalid config. Missing property "connections" inside it')
  }

  if (!config.connection || !(config.connection in config.connections)) {
    throw new InvalidArgumentsException(
      'Invalid config. Missing property "connection" or the connection name is not defined inside "connections" object'
    )
  }

  return config
}
