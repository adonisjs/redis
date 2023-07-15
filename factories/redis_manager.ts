/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { EmitterFactory } from '@adonisjs/core/factories/events'
import { Application } from '@adonisjs/core/app'
import RedisManager from '../src/redis_manager.js'
import { RedisClusterConfig, RedisConnectionConfig } from '../src/types/main.js'

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

  create(app: Application<any>) {
    return new RedisManager(app, this.#config, new EmitterFactory().create(app))
  }
}
