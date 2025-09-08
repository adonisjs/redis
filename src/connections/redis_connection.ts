/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { Redis, type RedisOptions } from 'ioredis'

import debug from '../debug.ts'
import { redisMethods } from './io_methods.ts'
import { redisCommand } from '../tracing_channels.ts'
import { AbstractConnection } from './abstract_connection.ts'
import type {
  ConnectionEvents,
  RedisConnectionConfig,
  IORedisConnectionCommands,
} from '../types.ts'

/**
 * Redis connection exposes the API to run Redis commands using `ioredis` as the
 * underlying client. The class abstracts the need of creating and managing
 * multiple pub/sub connections by hand, since it handles that internally
 * by itself.
 *
 * @example
 * ```ts
 * const redis = new RedisConnection('main', {
 *   host: 'localhost',
 *   port: 6379
 * })
 *
 * await redis.set('key', 'value')
 * const value = await redis.get('key')
 * ```
 */
export class RedisConnection extends AbstractConnection<Redis, ConnectionEvents<RedisConnection>> {
  /**
   * Normalized Redis configuration options
   */
  #config: RedisOptions

  /**
   * Returns the connection mode
   */
  get mode() {
    return this.ioConnection.mode
  }

  /**
   * Returns the connection mode for the subscriber
   * connection
   */
  get subscribeMode() {
    return this.ioSubscriberConnection?.mode
  }

  /**
   * Create a new Redis connection
   *
   * @param connectionName - Unique name for this connection
   * @param config - Redis connection configuration
   *
   * @example
   * ```ts
   * const connection = new RedisConnection('main', {
   *   host: 'localhost',
   *   port: 6379,
   *   password: 'secret'
   * })
   * ```
   */
  constructor(connectionName: string, config: RedisConnectionConfig) {
    debug('creating connection %s: %O', connectionName, config)
    super(connectionName)
    this.#config = this.#normalizeConfig(config)

    this.ioConnection = new Redis(this.#config)
    const originalSendCommand = this.ioConnection.sendCommand

    this.ioConnection.sendCommand = function (command, ...args) {
      return redisCommand.tracePromise(
        originalSendCommand as (...args: Parameters<Redis['sendCommand']>) => Promise<any>,
        redisCommand.hasSubscribers ? { command } : undefined,
        this,
        command,
        ...args
      )
    }

    this.monitorConnection()
  }

  /**
   * Normalizes config option to be compatible with IORedis
   *
   * @param config - Raw configuration object
   */
  #normalizeConfig(config: RedisConnectionConfig): RedisOptions {
    if (typeof config.port === 'string') {
      config.port = Number(config.port)
    }
    if (config.password && typeof config.password !== 'string') {
      config.password = config.password.release()
    }
    if (config.sentinelPassword && typeof config.sentinelPassword !== 'string') {
      config.sentinelPassword = config.sentinelPassword.release()
    }
    return config as RedisOptions
  }

  /**
   * Creates the subscriber connection, the AbstractConnection will
   * invoke this method when first subscription is created.
   */
  protected makeSubscriberConnection() {
    debug('creating subscriber connection')
    this.ioSubscriberConnection = new Redis(this.#config)
    this.monitorSubscriberConnection()
  }
}

/**
 * Adding IORedis methods dynamically on the RedisConnection
 * class and also extending its TypeScript types
 */
export interface RedisConnection extends IORedisConnectionCommands {}

redisMethods.forEach((method) => {
  ;(RedisConnection.prototype as any)[method] = function redisConnectionProxyFn(...args: any[]) {
    return this.ioConnection[method](...args)
  }
})

export default RedisConnection
