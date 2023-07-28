/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import RedisManager from '../src/redis_manager.js'
import { LoggerFactory } from '@adonisjs/core/factories/logger'
import type { RedisClusterConnectionConfig, RedisConnectionConfig } from '../src/types/main.js'

/**
 * Redis manager factory is used to create an instance of the redis
 * manager for testing
 */
export class RedisManagerFactory<
  ConnectionsList extends Record<string, RedisClusterConnectionConfig | RedisConnectionConfig>,
> {
  #config: {
    connection: keyof ConnectionsList
    connections: ConnectionsList
  }

  logs: string[] = []

  constructor(config: { connection: keyof ConnectionsList; connections: ConnectionsList }) {
    this.#config = config
  }

  /**
   * Create an instance of the redis manager
   */
  create() {
    return new RedisManager(
      this.#config,
      new LoggerFactory()
        .merge({
          enabled: true,
        })
        .pushLogsTo(this.logs)
        .create()
    )
  }
}
