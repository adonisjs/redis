/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import type { Application } from '@adonisjs/core/app'
import type { RedisClusterConfig, RedisConnectionConfig } from '../src/types/main.js'
import { EmitterFactory } from '@adonisjs/core/factories/events'
import RedisManager from '../src/redis_manager.js'

/**
 * Redis manager factory is used to create an instance of the redis
 * manager for testing
 */
export class RedisManagerFactory<
  ConnectionsList extends Record<string, RedisClusterConfig | RedisConnectionConfig>,
> {
  #config: {
    connection: keyof ConnectionsList
    connections: ConnectionsList
  }

  constructor(config: { connection: keyof ConnectionsList; connections: ConnectionsList }) {
    this.#config = config
  }

  /**
   * Create an instance of the redis manager
   */
  create(app: Application<any>) {
    return new RedisManager(this.#config, new EmitterFactory().create(app))
  }
}
