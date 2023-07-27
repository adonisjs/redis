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
import { IORedisCommands, RedisConnectionConfig } from '../types/main.js'

/**
 * Redis connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 */
export class RedisConnection extends AbstractConnection<Redis> {
  #config: RedisOptions

  constructor(connectionName: string, config: RedisConnectionConfig) {
    super(connectionName)
    this.#config = this.#normalizeConfig(config)

    this.ioConnection = new Redis(this.#config)
    this.monitorConnection()
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
    this.monitorSubscriberConnection()
  }
}

/**
 * Adding IORedis methods dynamically on the RedisConnection
 * class and also extending its TypeScript types
 */
export interface RedisConnection extends IORedisCommands {}
ioMethods.forEach((method) => {
  ;(RedisConnection.prototype as any)[method] = function redisConnectionProxyFn(...args: any[]) {
    return this.ioConnection[method](...args)
  }
})

export default RedisConnection
