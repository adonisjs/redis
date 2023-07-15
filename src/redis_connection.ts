/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Redis, RedisOptions } from 'ioredis'

import { ioMethods } from './io_methods.js'
import { AbstractConnection } from './abstract_connection.js'
import { RedisConnectionConfig, RedisConnectionFactory } from './types/main.js'

/**
 * Redis connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 */
export class RawRedisConnection extends AbstractConnection<Redis> {
  #config: RedisOptions

  constructor(connectionName: string, config: RedisConnectionConfig) {
    super(connectionName)
    this.#config = this.#normalizeConfig(config)

    this.ioConnection = new Redis(this.#config)
    this.proxyConnectionEvents()
  }

  /**
   * Normalizes config option to be compatible with IORedis
   */
  #normalizeConfig(config: RedisConnectionConfig): RedisOptions {
    if (typeof config.port === 'string') {
      config.port = Number(config.port)
    }
    return config as RedisOptions
  }

  /**
   * Creates the subscriber connection, the [[AbstractConnection]] will
   * invoke this method when first subscription is created.
   */
  protected makeSubscriberConnection() {
    this.ioSubscriberConnection = new Redis(this.#config)
  }
}

/**
 * Here we attach pubsub and ioRedis methods to the class.
 *
 * But we also need to inform typescript about the existence of
 * these methods. So we are exporting the class with a
 * casted type that has these methods.
 */
const RedisConnection = RawRedisConnection as unknown as RedisConnectionFactory

ioMethods.forEach((method) => {
  RedisConnection.prototype[method] = function redisConnectionProxyFn(...args: any[]) {
    return this.ioConnection[method](...args)
  }
})

export default RedisConnection
