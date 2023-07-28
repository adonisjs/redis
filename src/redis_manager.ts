/*
 * @adonisjs/redis
 *
 * (c) AdonisJS
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import Emittery from 'emittery'
import { RuntimeException } from '@poppinss/utils'
import type { Logger } from '@adonisjs/core/logger'

import debug from './debug.js'
import { baseMethods } from './connections/io_methods.js'
import RedisConnection from './connections/redis_connection.js'
import RedisClusterConnection from './connections/redis_cluster_connection.js'
import type {
  GetConnectionType,
  IORedisBaseCommands,
  PubSubChannelHandler,
  PubSubPatternHandler,
  RedisConnectionsList,
} from './types/main.js'

/**
 * Redis Manager exposes the API to manage multiple redis connections
 * based upon user defined config.
 *
 * All connections are long-lived until they are closed explictly
 */
class RedisManager<ConnectionsList extends RedisConnectionsList> extends Emittery<{
  connection: RedisConnection | RedisClusterConnection
}> {
  #logger: Logger

  /**
   * Should we log redis errors or not
   */
  #shouldLogRedisErrors: boolean = true

  /**
   * The default error reporter we use to log redis errors
   */
  #errorReporter = function logRedisError(this: RedisManager<ConnectionsList>, error: any) {
    this.#logger.fatal({ err: error }, 'Redis connection failure')
  }.bind(this)

  /**
   * User provided config
   */
  #config: {
    connection: keyof ConnectionsList
    connections: ConnectionsList
  }

  /**
   * A copy of live connections. We avoid re-creating a new connection
   * everytime and re-use connections.
   */
  activeConnections: {
    [K in keyof ConnectionsList]?: GetConnectionType<ConnectionsList, K>
  } = {}

  /**
   * Returns the length of active connections
   */
  get activeConnectionsCount() {
    return Object.keys(this.activeConnections).length
  }

  constructor(
    config: { connection: keyof ConnectionsList; connections: ConnectionsList },
    logger: Logger
  ) {
    super()
    this.#config = config
    this.#logger = logger
  }

  /**
   * Disable error logging of redis connection errors. You must
   * handle the errors manually, otheriwse the app will crash
   */
  doNotLogErrors() {
    this.#shouldLogRedisErrors = false
    Object.keys(this.activeConnections).forEach((name) => {
      debug('removing error reporter from %s connection', name)
      this.activeConnections[name]?.removeListener('error', this.#errorReporter)
    })
    return this
  }

  /**
   * Returns redis factory for a given named connection
   */
  connection<ConnectionName extends keyof ConnectionsList>(
    connectionName?: ConnectionName
  ): GetConnectionType<ConnectionsList, ConnectionName> {
    const name = connectionName || this.#config.connection
    debug('resolving connection %s', name)

    /**
     * Return existing connection if already exists
     */
    if (this.activeConnections[name]) {
      debug('reusing existing connection %s', name)
      return this.activeConnections[name] as GetConnectionType<ConnectionsList, ConnectionName>
    }

    /**
     * Get config for the named connection
     */
    const config = this.#config.connections[name]
    if (!config) {
      throw new RuntimeException(`Redis connection "${name.toString()}" is not defined`)
    }

    /**
     * Instantiate the connection based upon the config
     */
    debug('creating new connection %s', name)
    const connection =
      'clusters' in config
        ? new RedisClusterConnection(name as string, config)
        : new RedisConnection(name as string, config)

    /**
     * Notify about a new connection
     */
    this.emit('connection', connection)

    /**
     * Log errors when not disabled by the user
     */
    if (this.#shouldLogRedisErrors) {
      debug('attaching error reporter to log connection errors')
      connection.on('error', this.#errorReporter)
      connection.on('subscriber:error', this.#errorReporter)
    }

    /**
     * Remove connection from the list of tracked connections
     */
    connection.on('end', ($connection) => {
      debug('%s connection closed. Removing from tracked connections list', name)
      delete this.activeConnections[$connection.connectionName]
    })

    /**
     * Cache the connection so that we can re-use it later
     */
    this.activeConnections[name] = connection as GetConnectionType<ConnectionsList, ConnectionName>
    return connection as GetConnectionType<ConnectionsList, ConnectionName>
  }

  /**
   * Subscribe to a given channel to receive Redis pub/sub events. A
   * new subscriber connection will be created/managed automatically.
   */
  subscribe(channel: string, handler: PubSubChannelHandler): void {
    return this.connection().subscribe(channel, handler)
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string) {
    return this.connection().unsubscribe(channel)
  }

  /**
   * Make redis subscription for a pattern
   */
  psubscribe(pattern: string, handler: PubSubPatternHandler): void {
    return this.connection().psubscribe(pattern, handler)
  }

  /**
   * Unsubscribe from a given pattern
   */
  punsubscribe(pattern: string) {
    return this.connection().punsubscribe(pattern)
  }

  /**
   * Publish the pub/sub message
   */
  publish(
    channel: string,
    message: string,
    callback: (error: Error | null | undefined, count: number | undefined) => void
  ): void
  publish(channel: string, message: string): Promise<number>
  publish(
    channel: string,
    message: string,
    callback?: (error: Error | null | undefined, count: number | undefined) => void
  ) {
    return callback
      ? this.connection().publish(channel, message, callback)
      : this.connection().publish(channel, message)
  }

  /**
   * Quit a named connection or the default connection when no
   * name is defined.
   */
  async quit<ConnectionName extends keyof ConnectionsList>(name?: ConnectionName) {
    const connection = this.activeConnections[name || this.#config.connection]
    if (!connection) {
      return
    }

    return connection.quit()
  }

  /**
   * Disconnect a named connection or the default connection when no
   * name is defined.
   */
  async disconnect<ConnectionName extends keyof ConnectionsList>(name?: ConnectionName) {
    const connection = this.activeConnections[name || this.#config.connection]
    if (!connection) {
      return
    }

    return connection.disconnect()
  }

  /**
   * Quit all connections
   */
  async quitAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.quit(name)))
  }

  /**
   * Disconnect all connections
   */
  async disconnectAll(): Promise<void> {
    await Promise.all(Object.keys(this.activeConnections).map((name) => this.disconnect(name)))
  }
}

interface RedisManager<ConnectionsList extends RedisConnectionsList> extends IORedisBaseCommands {}
baseMethods.forEach((method) => {
  ;(RedisManager.prototype as any)[method] = function redisConnectionProxyFn(...args: any[]) {
    return this.connection()[method](...args)
  }
})

export default RedisManager
